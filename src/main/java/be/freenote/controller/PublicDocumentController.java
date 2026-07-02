package be.freenote.controller;

import be.freenote.dto.response.PageResponse;
import be.freenote.dto.response.PublicDocumentSummary;
import be.freenote.service.PublicDocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

/**
 * Anonymous, copyright-safe teaser of the catalogue (Notes/Divers, verified only). GET-{@code permitAll}
 * in SecurityConfig — crawlable SEO/AdSense surface. Returns metadata only (no author, no file URL);
 * the actual PDF stays behind {@code hasRole("VERIFIED")} via the regular document endpoints.
 */
@RestController
@RequestMapping("/api/public/documents")
@RequiredArgsConstructor
public class PublicDocumentController {

    private static final int MAX_PAGE_SIZE = 50;

    private final PublicDocumentService service;

    @GetMapping
    public ResponseEntity<PageResponse<PublicDocumentSummary>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), MAX_PAGE_SIZE));
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(service.listExcerpts(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PublicDocumentSummary> get(@PathVariable Long id) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(service.getExcerpt(id));
    }
}
