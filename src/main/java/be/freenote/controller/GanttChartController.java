package be.freenote.controller;

import be.freenote.dto.request.SaveGanttRequest;
import be.freenote.dto.response.GanttResponse;
import be.freenote.dto.response.GanttSummary;
import be.freenote.dto.response.PageResponse;
import be.freenote.security.SecurityUtils;
import be.freenote.security.ratelimit.RateLimit;
import be.freenote.service.GanttChartService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Saved & shared Gantt projects. All endpoints sit under {@code /api/**} → the global rule
 * {@code anyRequest().hasRole("VERIFIED")} applies: saving, listing and sharing are reserved to
 * verified students. Anonymous users use the tool 100% client-side (build + export) and never reach
 * this controller.
 */
@RestController
@RequestMapping("/api/gantt-charts")
@RequiredArgsConstructor
public class GanttChartController {

    private static final int MAX_PAGE_SIZE = 50;

    private final GanttChartService service;

    @GetMapping("/mine")
    public ResponseEntity<PageResponse<GanttSummary>> mine(Authentication authentication,
                                                           @RequestParam(defaultValue = "0") int page,
                                                           @RequestParam(defaultValue = "30") int size) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.ok(service.listMine(userId, pageable(page, size)));
    }

    @GetMapping("/shared")
    public ResponseEntity<PageResponse<GanttSummary>> shared(@RequestParam(defaultValue = "0") int page,
                                                             @RequestParam(defaultValue = "30") int size) {
        return ResponseEntity.ok(service.listShared(pageable(page, size)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<GanttResponse> get(Authentication authentication, @PathVariable Long id) {
        return ResponseEntity.ok(service.get(SecurityUtils.currentUserId(authentication), isAdmin(authentication), id));
    }

    @PostMapping
    @RateLimit(max = 30, window = 3600)
    public ResponseEntity<GanttResponse> create(Authentication authentication,
                                                @Valid @RequestBody SaveGanttRequest request) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(userId, request));
    }

    @PutMapping("/{id}")
    @RateLimit(max = 30, window = 3600) // aligné sur create — sinon updates JSONB illimités
    public ResponseEntity<GanttResponse> update(Authentication authentication, @PathVariable Long id,
                                                @Valid @RequestBody SaveGanttRequest request) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.ok(service.update(userId, isAdmin(authentication), id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(Authentication authentication, @PathVariable Long id) {
        service.delete(SecurityUtils.currentUserId(authentication), isAdmin(authentication), id);
        return ResponseEntity.noContent().build();
    }

    private static Pageable pageable(int page, int size) {
        return PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), MAX_PAGE_SIZE));
    }

    private static boolean isAdmin(Authentication authentication) {
        return authentication.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }
}
