package be.freenote.controller;

import be.freenote.dto.response.AdminUserSupportResponse;
import be.freenote.dto.response.SystemStatusResponse;
import be.freenote.service.AdminSystemService;
import be.freenote.service.AdminUserSupportService;
import be.freenote.service.ActivityLogService;
import be.freenote.enums.ActivityType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Fiche d'un compte + déblocages, et pane Système — ADMIN (wildcard {@code /api/admin/**}). */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminSupportController {

    private final AdminUserSupportService supportService;
    private final AdminSystemService systemService;
    private final ActivityLogService activityLogService;

    @GetMapping("/users/{id}/support")
    public ResponseEntity<AdminUserSupportResponse> support(@PathVariable Long id) {
        return ResponseEntity.ok(supportService.get(id));
    }

    @DeleteMapping("/users/{id}/verification-code")
    public ResponseEntity<Void> cancelCode(@PathVariable Long id) {
        supportService.cancelCode(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{id}/verification-attempts")
    public ResponseEntity<Void> resetAttempts(@PathVariable Long id) {
        supportService.resetAttempts(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{id}/rate-limits")
    public ResponseEntity<Map<String, Integer>> clearRateLimits(@PathVariable Long id) {
        return ResponseEntity.ok(Map.of("cleared", supportService.clearRateLimits(id)));
    }

    @GetMapping("/system")
    public ResponseEntity<SystemStatusResponse> system() {
        return ResponseEntity.ok(systemService.status());
    }

    @PostMapping("/system/search-resync")
    public ResponseEntity<Void> resyncSearch() {
        systemService.resyncSearchIndex();
        activityLogService.logStaff(ActivityType.STAFF_ACTION, "Resynchronisation de l'index de recherche lancée");
        return ResponseEntity.noContent().build();
    }
}
