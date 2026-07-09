package be.freenote.controller;

import be.freenote.dto.response.AdminOverviewResponse;
import be.freenote.dto.response.AnalyticsResponse;
import be.freenote.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Agrégats du panel admin. {@code /api/admin/**} → ROLE_ADMIN + re-vérification DB du rôle. */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminAnalyticsController {

    private final AnalyticsService analyticsService;

    /** Accueil « Vue d'ensemble » : badges des files + KPI 7 j + activité 14 j. */
    @GetMapping("/overview")
    public ResponseEntity<AdminOverviewResponse> overview() {
        return ResponseEntity.ok(analyticsService.getOverview());
    }

    /** Page Analytics complète — {@code days} clampé 7..365 côté service. */
    @GetMapping("/analytics")
    public ResponseEntity<AnalyticsResponse> analytics(@RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(analyticsService.getAnalytics(days));
    }
}
