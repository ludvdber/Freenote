package be.freenote.controller;

import be.freenote.security.SecurityUtils;
import be.freenote.dto.request.CreateCourseRequest;
import be.freenote.dto.response.CourseResponse;
import be.freenote.dto.response.CourseStatsResponse;
import be.freenote.service.CourseService;
import be.freenote.security.ratelimit.RateLimit;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/courses")
@RequiredArgsConstructor
public class CourseController {

    private final CourseService courseService;

    @GetMapping
    public ResponseEntity<List<CourseResponse>> getBySectionId(@RequestParam Long sectionId) {
        return ResponseEntity.ok(courseService.getBySectionId(sectionId));
    }

    /** Fiche d'un cours (nom réel, section) — le bandeau de la page cours ne dépend plus du premier
     *  document listé pour connaître son propre nom. */
    @GetMapping("/{id}")
    public ResponseEntity<CourseResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok()
                // private : endpoint authentifié par cookie — jamais de cache partagé.
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(2)).cachePrivate())
                .body(courseService.getById(id));
    }

    /** Stats agrégées du bandeau page cours (docs, vues, note moyenne, dernier ajout). */
    @GetMapping("/{id}/stats")
    public ResponseEntity<CourseStatsResponse> getStats(@PathVariable Long id) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(2)).cachePrivate())
                .body(courseService.getStats(id));
    }

    /** Cours équivalents (V15) — alimente le bandeau « Inclut aussi les documents de… » de la page cours. */
    @GetMapping("/{id}/equivalents")
    public ResponseEntity<List<CourseResponse>> getEquivalents(@PathVariable Long id) {
        return ResponseEntity.ok(courseService.getEquivalents(id));
    }

    @PostMapping
    @RateLimit(max = 5, window = 3600)
    public ResponseEntity<CourseResponse> create(Authentication authentication,
                                                  @Valid @RequestBody CreateCourseRequest request) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(courseService.create(request, userId));
    }
}
