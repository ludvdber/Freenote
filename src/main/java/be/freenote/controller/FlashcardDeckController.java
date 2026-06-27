package be.freenote.controller;

import be.freenote.dto.request.PublishDeckRequest;
import be.freenote.dto.response.FlashcardDeckResponse;
import be.freenote.dto.response.FlashcardDeckSummary;
import be.freenote.dto.response.PageResponse;
import be.freenote.security.SecurityUtils;
import be.freenote.security.ratelimit.RateLimit;
import be.freenote.service.FlashcardDeckService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Shared flashcard decks (palier C). All endpoints sit under {@code /api/**} so the global rule
 * {@code anyRequest().hasRole("VERIFIED")} applies — publishing, browsing and importing shared decks
 * are reserved to verified ISFCE students (no anonymous/public surface, hence no extra moderation).
 */
@RestController
@RequestMapping("/api/flashcard-decks")
@RequiredArgsConstructor
public class FlashcardDeckController {

    private static final int MAX_PAGE_SIZE = 50;

    private final FlashcardDeckService service;

    @PostMapping
    @RateLimit(max = 10, window = 3600)
    public ResponseEntity<FlashcardDeckResponse> publish(Authentication authentication,
                                                         @Valid @RequestBody PublishDeckRequest request) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.status(HttpStatus.CREATED).body(service.publish(userId, request));
    }

    @GetMapping
    public ResponseEntity<PageResponse<FlashcardDeckSummary>> list(
            @RequestParam(required = false) Long courseId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), MAX_PAGE_SIZE));
        return ResponseEntity.ok(service.list(courseId, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<FlashcardDeckResponse> get(@PathVariable Long id) {
        return ResponseEntity.ok(service.get(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(Authentication authentication, @PathVariable Long id) {
        Long userId = SecurityUtils.currentUserId(authentication);
        boolean isAdmin = authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        service.delete(userId, isAdmin, id);
        return ResponseEntity.noContent().build();
    }
}
