package be.freenote.controller;

import be.freenote.dto.response.CountdownResponse;
import be.freenote.dto.response.FundingResponse;
import be.freenote.service.DonationService;
import be.freenote.service.SettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * Réglages publics de la home. Sous {@code /api/public/**} → GET permitAll (SecurityConfig) : la
 * bannière du compte à rebours est visible des anonymes comme le reste de la home publique.
 */
@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicSettingsController {

    private final SettingsService settingsService;
    private final DonationService donationService;

    /** Compte à rebours (rentrée…) — date/label null = pas de bannière. */
    @GetMapping("/countdown")
    public ResponseEntity<CountdownResponse> getCountdown() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)))
                .body(settingsService.getCountdown());
    }

    /** Thermomètre de financement du mois — {@code monthlyCost} null = jauge désactivée.
     *  Aucune donnée personnelle : un coût configuré par l'admin + une somme agrégée. */
    @GetMapping("/funding")
    public ResponseEntity<FundingResponse> getFunding() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)))
                .body(donationService.getFunding());
    }
}
