package be.freenote.controller;

import be.freenote.security.SecurityUtils;
import be.freenote.dto.request.ConfirmCodeRequest;
import be.freenote.dto.request.VerifyEmailRequest;
import be.freenote.security.JwtRevocationService;
import be.freenote.security.JwtTokenProvider;
import be.freenote.security.OAuth2LoginSuccessHandler;
import be.freenote.security.ratelimit.RateLimit;
import be.freenote.service.AuthService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Validated
public class AuthController {

    private final AuthService authService;
    private final JwtTokenProvider jwtTokenProvider;
    private final JwtRevocationService jwtRevocationService;

    @Value("${app.jwt.expiration-ms}")
    private long jwtExpirationMs;

    @Value("${app.cookie.secure:true}")
    private boolean cookieSecure;

    @PostMapping("/request-verification")
    @RateLimit(max = 3, window = 3600)
    public ResponseEntity<Void> requestVerification(Authentication authentication,
                                                     @Valid @RequestBody VerifyEmailRequest request) {
        Long userId = SecurityUtils.currentUserId(authentication);
        authService.requestVerification(userId, request.getEmail());
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/confirm-verification")
    @RateLimit(max = 5, window = 900)
    public ResponseEntity<Void> confirmVerification(Authentication authentication,
                                                     @Valid @RequestBody ConfirmCodeRequest request,
                                                     HttpServletResponse response) {
        Long userId = SecurityUtils.currentUserId(authentication);
        String jwt = authService.confirmVerification(userId, request.getCode());
        OAuth2LoginSuccessHandler.addJwtCookie(response, jwt, jwtExpirationMs, cookieSecure);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(jakarta.servlet.http.HttpServletRequest request,
                                        HttpServletResponse response) {
        String jwt = extractJwtCookie(request);
        if (jwt != null && jwtTokenProvider.validateToken(jwt)) {
            jwtRevocationService.revoke(
                    jwtTokenProvider.getJti(jwt),
                    jwtTokenProvider.getExpiration(jwt));
        }
        OAuth2LoginSuccessHandler.clearJwtCookie(response, cookieSecure);
        return ResponseEntity.noContent().build();
    }

    private static String extractJwtCookie(jakarta.servlet.http.HttpServletRequest request) {
        var cookies = request.getCookies();
        if (cookies == null) return null;
        for (var c : cookies) {
            if ("jwt".equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) {
                return c.getValue();
            }
        }
        return null;
    }
}
