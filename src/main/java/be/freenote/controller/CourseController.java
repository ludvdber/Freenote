package be.freenote.controller;

import be.freenote.security.SecurityUtils;
import be.freenote.dto.request.CreateCourseRequest;
import be.freenote.dto.response.CourseResponse;
import be.freenote.service.CourseService;
import be.freenote.security.ratelimit.RateLimit;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

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
