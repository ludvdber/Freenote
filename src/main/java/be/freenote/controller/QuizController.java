package be.freenote.controller;

import be.freenote.dto.request.CreateQuizRequest;
import be.freenote.dto.request.SubmitAttemptRequest;
import be.freenote.dto.response.AttemptResultResponse;
import be.freenote.dto.response.QuizLeaderboardEntry;
import be.freenote.dto.response.QuizPlayResponse;
import be.freenote.dto.response.QuizSummary;
import be.freenote.dto.response.PageResponse;
import be.freenote.security.SecurityUtils;
import be.freenote.security.ratelimit.RateLimit;
import be.freenote.service.QuizService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Shared quizzes. All endpoints sit under {@code /api/**} so the global rule
 * {@code anyRequest().hasRole("VERIFIED")} applies — creating, browsing, playing and ranking are
 * reserved to verified ISFCE students (no anonymous/public surface, hence no extra moderation). The
 * "anyone can play" path is a client-only quiz encoded in the URL and never reaches this controller.
 */
@RestController
@RequestMapping("/api/quizzes")
@RequiredArgsConstructor
public class QuizController {

    private static final int MAX_PAGE_SIZE = 50;

    private final QuizService service;

    @PostMapping
    @RateLimit(max = 10, window = 3600)
    public ResponseEntity<QuizSummary> create(Authentication authentication,
                                              @Valid @RequestBody CreateQuizRequest request) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(userId, request));
    }

    @GetMapping
    public ResponseEntity<PageResponse<QuizSummary>> list(
            @RequestParam(required = false) Long courseId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), MAX_PAGE_SIZE));
        return ResponseEntity.ok(service.list(courseId, pageable));
    }

    @GetMapping("/{id}/play")
    public ResponseEntity<QuizPlayResponse> play(@PathVariable Long id) {
        return ResponseEntity.ok(service.play(id));
    }

    @PostMapping("/{id}/attempts")
    @RateLimit(max = 60, window = 3600)
    public ResponseEntity<AttemptResultResponse> submit(Authentication authentication,
                                                        @PathVariable Long id,
                                                        @Valid @RequestBody SubmitAttemptRequest request) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.ok(service.submit(userId, id, request));
    }

    @GetMapping("/{id}/leaderboard")
    public ResponseEntity<List<QuizLeaderboardEntry>> leaderboard(@PathVariable Long id,
                                                                  @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(service.leaderboard(id, size));
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
