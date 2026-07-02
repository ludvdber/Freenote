package be.freenote.controller;

import be.freenote.dto.response.GuideResponse;
import be.freenote.dto.response.GuideSummary;
import be.freenote.dto.response.PageResponse;
import be.freenote.service.GuideService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

/**
 * Public guide reading. Both endpoints are GET-{@code permitAll} in SecurityConfig (original,
 * indexable content — no login wall), so anonymous visitors and crawlers can read them; drafts are
 * never exposed (the service filters on {@code published}). Writing is admin-only via
 * {@link AdminGuideController}.
 */
@RestController
@RequestMapping("/api/guides")
@RequiredArgsConstructor
public class GuideController {

    private static final int MAX_PAGE_SIZE = 50;

    private final GuideService service;

    @GetMapping
    public ResponseEntity<PageResponse<GuideSummary>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), MAX_PAGE_SIZE));
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(service.listPublished(pageable));
    }

    @GetMapping("/{slug}")
    public ResponseEntity<GuideResponse> get(@PathVariable String slug) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(service.getPublishedBySlug(slug));
    }
}
