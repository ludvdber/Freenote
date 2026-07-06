package be.freenote.controller;

import be.freenote.security.SecurityUtils;
import be.freenote.dto.request.RateRequest;
import be.freenote.security.ratelimit.RateLimit;
import be.freenote.service.RatingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/documents/{docId}/ratings")
@RequiredArgsConstructor
public class RatingController {

    private final RatingService ratingService;

    @PostMapping
    @RateLimit(max = 10, window = 3600)
    public ResponseEntity<Void> rate(Authentication authentication,
                                      @PathVariable Long docId,
                                      @Valid @RequestBody RateRequest request) {
        Long userId = SecurityUtils.currentUserId(authentication);
        ratingService.rate(userId, docId, request.getScore());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/average")
    public ResponseEntity<Double> getAverage(@PathVariable Long docId) {
        Double avg = ratingService.getAverageRating(docId);
        return ResponseEntity.ok(avg != null ? avg : 0.0);
    }

    /** Ma note sur ce document (0 = pas encore noté) — permet au viewer d'afficher « Ta note »
     *  séparément de la moyenne, au lieu d'un seul contrôle ambigu qui mélange les deux. */
    @GetMapping("/mine")
    public ResponseEntity<Integer> getMine(Authentication authentication, @PathVariable Long docId) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.ok(ratingService.getUserScore(userId, docId));
    }
}
