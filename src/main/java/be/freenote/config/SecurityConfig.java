package be.freenote.config;

import be.freenote.security.AdminRoleVerificationFilter;
import be.freenote.security.JwtAuthFilter;
import be.freenote.security.CustomOAuth2UserService;
import be.freenote.security.OAuth2LoginFailureHandler;
import be.freenote.security.OAuth2LoginSuccessHandler;
import jakarta.servlet.DispatcherType;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final AdminRoleVerificationFilter adminRoleVerificationFilter;
    private final CustomOAuth2UserService customOAuth2UserService;
    private final OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;
    private final OAuth2LoginFailureHandler oAuth2LoginFailureHandler;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        // CSRF: use cookie-based token so the SPA can read it and send it back as header
        var csrfTokenRepository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        var csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName(null); // disable deferred loading

        http
            .csrf(csrf -> csrf
                .csrfTokenRepository(csrfTokenRepository)
                .csrfTokenRequestHandler(csrfHandler)
                // Exempt webhook + public GET endpoints from CSRF.
                // /api/dev/** is handled by DevSecurityConfig under the dev profile only.
                .ignoringRequestMatchers(
                    "/api/webhooks/**",
                    "/api/auth/**"
                )
            )
            .cors(cors -> cors.configure(http))
            .headers(headers -> headers
                .cacheControl(cache -> cache.disable()) // Controllers set Cache-Control explicitly where needed
                // HSTS: force HTTPS for 2 years, applies to all subdomains, eligible for browser preload lists.
                // Only emitted when the request is secure (nginx sets X-Forwarded-Proto=https in prod).
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .preload(true)
                    .maxAgeInSeconds(63072000)
                )
                // Stronger referrer: send only origin on cross-origin, nothing on HTTP downgrade.
                .referrerPolicy(ref -> ref.policy(
                    org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN
                ))
                // Lock down sensitive browser features we don't use.
                .permissionsPolicyHeader(policy -> policy.policy(
                    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
                ))
                // X-Frame-Options: SAMEORIGIN so we can embed our own PDFs in <iframe>
                // (DocumentView). Combined with CSP frame-ancestors 'self' below, third-party
                // sites still cannot embed Freenote — only the app itself can iframe its own pages.
                .frameOptions(frame -> frame.sameOrigin())
                .contentSecurityPolicy(csp -> csp
                    .policyDirectives(
                        "default-src 'self'; " +
                        // AdSense + Google CMP (Funding Choices) loaders. Manual <ins> ad units
                        // work without 'unsafe-inline'; if an ad format is blocked, the browser
                        // console logs the exact missing domain/directive to add here.
                        // 'wasm-unsafe-eval' lets the Flashcards tool instantiate the sql.js
                        // WebAssembly module (Anki .apkg import) — it permits WASM compilation only,
                        // NOT arbitrary eval(), so it is a narrow, well-understood relaxation.
                        "script-src 'self' 'wasm-unsafe-eval' https://pagead2.googlesyndication.com https://*.googlesyndication.com " +
                            "https://adservice.google.com https://*.googleadservices.com https://*.google.com " +
                            "https://www.googletagservices.com https://fundingchoicesmessages.google.com; " +
                        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                        "font-src 'self' https://fonts.gstatic.com; " +
                        "img-src 'self' data: blob: https://api.dicebear.com https://cdn.discordapp.com " +
                            "https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.gstatic.com " +
                            "https://*.googleusercontent.com https://*.bp.blogspot.com https://*.blogspot.com; " +
                        "connect-src 'self' https://pagead2.googlesyndication.com https://*.googlesyndication.com " +
                            "https://*.google.com https://*.doubleclick.net; " +
                        // pdf.js (PDF viewer) spawns its rendering Web Worker from a same-origin asset;
                        // 'blob:' covers the fallback worker some bundlers materialise as a blob URL.
                        "worker-src 'self' blob:; " +
                        "frame-src 'self' https://googleads.g.doubleclick.net https://tpc.googlesyndication.com " +
                            "https://*.googlesyndication.com https://*.doubleclick.net https://fundingchoicesmessages.google.com; " +
                        "frame-ancestors 'self'; " +
                        "base-uri 'self'; " +
                        "form-action 'self'"
                    )
                )
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // The notification SSE stream goes async. When the SseEmitter later completes,
                // Tomcat fires an ASYNC dispatch that replays the security chain; AuthorizationFilter
                // filters every dispatch type, but the SecurityContext isn't restored on the async
                // (virtual) thread, so it would deny the re-dispatch with a noisy "Access Denied /
                // response already committed" stacktrace. The initial REQUEST is still authorized —
                // permit the internal ASYNC/ERROR re-dispatches so the stream closes cleanly.
                .dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR).permitAll()

                // SPA static assets (Vite bundle embedded in the fat jar under /static)
                // — everything served by SpaForwardingConfig must be publicly reachable,
                // otherwise the login page itself would require a login.
                .requestMatchers(HttpMethod.GET,
                        "/", "/index.html", "/favicon.ico", "/robots.txt", "/ads.txt", "/sitemap.xml",
                        "/assets/**", "/static/**", "/*.svg", "/*.png", "/*.jpg", "/*.webp", "/*.ico"
                ).permitAll()

                // Public endpoints — tout le reste exige une authentification.
                // Politique appliquée : seules la home, Tools, les pages légales et le flux RSS école sont exposés sans login.
                .requestMatchers("/api/auth/logout").permitAll()
                .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                // All other actuator endpoints (metrics, info, …) are admin-only — never public.
                .requestMatchers("/actuator/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/news").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/guides", "/api/guides/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/public/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/webhooks/kofi").permitAll()

                // SPA deep-link routes (React Router owns them; index.html is served back by SpaForwardingConfig)
                .requestMatchers(HttpMethod.GET,
                        "/browse", "/browse/**",
                        "/upload", "/upload/**",
                        "/profile", "/profile/**",
                        "/leaderboard",
                        "/news", "/news/**",
                        "/guides", "/guides/**",
                        "/ressources", "/ressources/**",
                        "/admin", "/admin/**",
                        "/outils", "/outils/**", "/tools", "/tools/**",
                        "/legal", "/privacy", "/terms",
                        "/a-propos", "/about",
                        "/courses/**",
                        "/documents/**",
                        "/users/**"
                ).permitAll()

                // Admin endpoints
                .requestMatchers("/api/admin/**").hasRole("ADMIN")

                // Provisional accounts (logged in via Discord, ISFCE email NOT yet verified) may only
                // reach the onboarding endpoints: read their own profile, pick a username/section,
                // accept the terms, request/confirm email verification, and list sections for the picker.
                // Everything else (all documents, courses, profiles, leaderboard…) requires a verified
                // ISFCE email — no pedagogical content is visible without it.
                .requestMatchers(HttpMethod.GET, "/api/users/me").authenticated()
                .requestMatchers(HttpMethod.PUT, "/api/users/me/username").authenticated()
                .requestMatchers(HttpMethod.PUT, "/api/users/me/section").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/users/me/accept-terms").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/sections").authenticated()
                .requestMatchers("/api/auth/**").authenticated()

                // Everything else requires a verified ISFCE email.
                .anyRequest().hasRole("VERIFIED")
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(HttpStatus.UNAUTHORIZED.value());
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.getWriter().write(
                            "{\"status\":401,\"message\":\"Authentication required\"}");
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    response.setStatus(HttpStatus.FORBIDDEN.value());
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.getWriter().write(
                            "{\"status\":403,\"message\":\"Access denied\"}");
                })
            )
            .oauth2Login(oauth2 -> oauth2
                .userInfoEndpoint(userInfo -> userInfo
                    .userService(customOAuth2UserService)
                )
                .successHandler(oAuth2LoginSuccessHandler)
                .failureHandler(oAuth2LoginFailureHandler)
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(adminRoleVerificationFilter, JwtAuthFilter.class);

        return http.build();
    }
}
