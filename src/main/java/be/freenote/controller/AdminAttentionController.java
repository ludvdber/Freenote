package be.freenote.controller;

import be.freenote.dto.response.AdminAttentionResponse;
import be.freenote.service.AdminAttentionService;
import be.freenote.service.SystemAlertService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Santé SMTP, alertes système et inscriptions bloquées — ADMIN (wildcard {@code /api/admin/**}). */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminAttentionController {

    private final AdminAttentionService attentionService;
    private final SystemAlertService systemAlertService;

    @GetMapping("/attention")
    public ResponseEntity<AdminAttentionResponse> attention() {
        return ResponseEntity.ok(attentionService.getAttention());
    }

    @PutMapping("/alerts/acknowledge")
    public ResponseEntity<Void> acknowledgeAlerts() {
        systemAlertService.acknowledge();
        return ResponseEntity.noContent().build();
    }

    /** {@code result} : SENT, UNREACHABLE (MP fermés / pas sur le serveur), DISABLED (pas de bot), FAILED. */
    @PostMapping("/users/{id}/onboarding-reminder")
    public ResponseEntity<Map<String, String>> remind(@PathVariable Long id) {
        return ResponseEntity.ok(Map.of("result", attentionService.remindOnboarding(id).name()));
    }
}
