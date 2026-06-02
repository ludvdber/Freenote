package be.freenote.security;

import be.freenote.entity.User;
import be.freenote.repository.UserOauthLinkRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final UserOauthLinkRepository oauthLinkRepository;
    private final JwtTokenProvider jwtTokenProvider;

    @Value("${app.jwt.expiration-ms}")
    private long expirationMs;

    @Value("${app.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    @Value("${app.cookie.secure:true}")
    private boolean cookieSecure;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
        String provider = oauthToken.getAuthorizedClientRegistrationId().toUpperCase();
        String oauthId = oauthToken.getPrincipal().getName();

        // Discord-only sign-in / sign-up: look up the user via the (provider, oauthId) pair and
        // issue a new JWT cookie. Fetch the User eagerly (JOIN FETCH) — this handler runs outside
        // any transaction, so a lazy user proxy would throw LazyInitializationException when
        // generateToken() reads username/role.
        User user = oauthLinkRepository.findUserByProviderAndOauthId(provider, oauthId)
                .orElseThrow();

        String jwt = jwtTokenProvider.generateToken(user);
        addJwtCookie(response, jwt, expirationMs, cookieSecure);
        // Carry a one-shot flag so the SPA knows a cookie-based login just completed and must
        // call /api/users/me to hydrate — localStorage is still empty on a first sign-in, so
        // without this signal useAuthInit would skip the fetch and the user stays "logged out".
        getRedirectStrategy().sendRedirect(request, response, frontendUrl + "/?login=success");
    }

    public static void addJwtCookie(HttpServletResponse response, String jwt, long expirationMs, boolean secure) {
        Cookie cookie = new Cookie("jwt", jwt);
        cookie.setHttpOnly(true);
        cookie.setSecure(secure);
        cookie.setPath("/");
        cookie.setMaxAge((int) (expirationMs / 1000));
        cookie.setAttribute("SameSite", "Lax");
        response.addCookie(cookie);
    }

    public static void clearJwtCookie(HttpServletResponse response, boolean secure) {
        Cookie cookie = new Cookie("jwt", "");
        cookie.setHttpOnly(true);
        cookie.setSecure(secure);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        cookie.setAttribute("SameSite", "Lax");
        response.addCookie(cookie);
    }
}
