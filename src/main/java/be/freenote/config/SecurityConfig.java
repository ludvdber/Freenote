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
                // Exempt Ko-fi (server-to-server, no cookie session) and logout (must always work,
                // even with a stale/expired CSRF cookie). The other /api/auth/** endpoints are called
                // by the SPA, which sends X-XSRF-TOKEN on every request (axios interceptor) — no
                // reason to exempt them. /api/dev/** is handled by DevSecurityConfig (dev only).
                // Trade-off assumé sur logout : un site tiers peut théoriquement forcer une
                // déconnexion (POST cross-site) — nuisance sans gain pour l'attaquant, acceptée en
                // échange d'un logout qui ne peut jamais échouer.
                .ignoringRequestMatchers(
                    "/api/webhooks/**",
                    "/api/auth/logout"
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
                // X-Frame-Options: SAMEORIGIN + CSP frame-ancestors 'self' : aucun site tiers ne
                // peut embarquer Freenote. Le PDF est rendu via pdf.js dans un <canvas> (plus
                // d'<iframe> PDF depuis 2026-06) — SAMEORIGIN est gardé défensivement.
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

                // SPA shell + static assets : tout GET/HEAD hors préfixes backend (/api, /actuator,
                // /oauth2, /login) est soit un asset du bundle Vite, soit une route React servie
                // en index.html par SpaForwardingConfig. Miroir exact de la logique de
                // SpaForwardingConfig — ajouter une route React ne demande AUCUN changement ici,
                // et une URL inconnue affiche la page 404 du SPA au lieu d'un 401 JSON.
                // Les données restent protégées : elles passent toutes par /api/** (règles ci-dessous).
                .requestMatchers(SecurityConfig::isSpaOrStaticGet).permitAll()

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
                // Compteurs agrégés de la home (docs, vues, membres) — aucune donnée personnelle,
                // affichés aussi aux visiteurs anonymes (la home publique montre les stats).
                .requestMatchers(HttpMethod.GET, "/api/stats").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/webhooks/kofi").permitAll()

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

    /** GET/HEAD hors préfixes backend = shell SPA ou asset statique (voir SpaForwardingConfig). */
    private static boolean isSpaOrStaticGet(jakarta.servlet.http.HttpServletRequest request) {
        String method = request.getMethod();
        if (!"GET".equals(method) && !"HEAD".equals(method)) {
            return false;
        }
        String uri = request.getRequestURI();
        return !uri.startsWith("/api/")
                && !uri.startsWith("/actuator")
                && !uri.startsWith("/oauth2")
                && !uri.startsWith("/login");
    }
}
