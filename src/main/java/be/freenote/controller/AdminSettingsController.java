package be.freenote.controller;

import be.freenote.dto.request.UpdateCountdownRequest;
import be.freenote.dto.response.CountdownResponse;
import be.freenote.service.SettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Réglages du site (onglet admin « Réglages »). {@code /api/admin/**} → ROLE_ADMIN
 *  (+ re-vérification DB du rôle par {@code AdminRoleVerificationFilter}). */
@RestController
@RequestMapping("/api/admin/settings")
@RequiredArgsConstructor
public class AdminSettingsController {

    private final SettingsService settingsService;

    @GetMapping("/countdown")
    public ResponseEntity<CountdownResponse> getCountdown() {
        return ResponseEntity.ok(settingsService.getCountdown());
    }

    /** Date null = désactive la bannière. */
    @PutMapping("/countdown")
    public ResponseEntity<CountdownResponse> setCountdown(@Valid @RequestBody UpdateCountdownRequest request) {
        settingsService.setCountdown(request.date(), request.label());
        return ResponseEntity.ok(settingsService.getCountdown());
    }
}
