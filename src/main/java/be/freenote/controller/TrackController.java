package be.freenote.controller;

import be.freenote.dto.request.TrackRequest;
import be.freenote.security.SecurityUtils;
import be.freenote.security.ratelimit.RateLimit;
import be.freenote.service.TrackingService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Collecteur d'usage anonyme (fire-and-forget du frontend). POST permitAll + exempt CSRF
 * (déclaré explicitement dans SecurityConfig) : un POST cross-site ne peut qu'incrémenter un
 * compteur anonyme whitelisté — nuisance sans gain, bornée par le rate-limit IP.
 */
@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class TrackController {

    private final TrackingService trackingService;

    @PostMapping("/track")
    @RateLimit(max = 60, window = 60)
    public ResponseEntity<Void> track(@Valid @RequestBody TrackRequest request,
                                      Authentication authentication,
                                      HttpServletRequest httpRequest) {
        // Clé viewer pour la dédup des vues de profil : compte connecté sinon IP (remoteAddr est
        // fiabilisé par server.tomcat.remoteip + TRUSTED_PROXIES en prod).
        Long userId = SecurityUtils.currentUserIdOrNull(authentication);
        String viewerKey = userId != null ? "u" + userId : "ip" + httpRequest.getRemoteAddr();
        trackingService.trackClientEvent(request.metric(), request.target(), viewerKey);
        return ResponseEntity.noContent().build();
    }
}
