package be.freenote.controller;

import be.freenote.dto.request.CreateGuideRequest;
import be.freenote.dto.response.GuideResponse;
import be.freenote.dto.response.GuideSummary;
import be.freenote.dto.response.PageResponse;
import be.freenote.security.SecurityUtils;
import be.freenote.service.GuideService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Authoring of guides — admins AND rédacteurs (V18). Sits under {@code /api/admin/guides/**} →
 * {@code hasAnyRole("ADMIN", "EDITOR")} (re-checked live per request by
 * {@code AdminRoleVerificationFilter}). The list/get here include drafts, unlike the public
 * {@link GuideController}; a rédacteur only ever sees/touches HIS OWN guides (service-enforced),
 * an admin everything.
 */
@RestController
@RequestMapping("/api/admin/guides")
@RequiredArgsConstructor
public class AdminGuideController {

    private static final int MAX_PAGE_SIZE = 100;

    private final GuideService service;

    @GetMapping
    public ResponseEntity<PageResponse<GuideSummary>> list(
            Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), MAX_PAGE_SIZE));
        return ResponseEntity.ok(service.listAll(
                SecurityUtils.currentUserId(authentication), isAdmin(authentication), pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<GuideResponse> get(Authentication authentication, @PathVariable Long id) {
        return ResponseEntity.ok(service.getById(
                id, SecurityUtils.currentUserId(authentication), isAdmin(authentication)));
    }

    @PostMapping
    public ResponseEntity<GuideResponse> create(Authentication authentication,
                                                @Valid @RequestBody CreateGuideRequest request) {
        Long authorId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(authorId, request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<GuideResponse> update(Authentication authentication, @PathVariable Long id,
                                                @Valid @RequestBody CreateGuideRequest request) {
        return ResponseEntity.ok(service.update(
                id, SecurityUtils.currentUserId(authentication), isAdmin(authentication), request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(Authentication authentication, @PathVariable Long id) {
        service.delete(id, SecurityUtils.currentUserId(authentication), isAdmin(authentication));
        return ResponseEntity.noContent().build();
    }

    private static boolean isAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }
}
