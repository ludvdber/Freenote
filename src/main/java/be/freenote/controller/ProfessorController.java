package be.freenote.controller;

import be.freenote.dto.request.CreateProfessorRequest;
import be.freenote.dto.response.ProfessorResponse;
import be.freenote.service.ProfessorService;
import be.freenote.security.ratelimit.RateLimit;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/professors")
@RequiredArgsConstructor
public class ProfessorController {

    private final ProfessorService professorService;

    @GetMapping
    public ResponseEntity<List<ProfessorResponse>> getAll() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(2)).cachePublic())
                .body(professorService.getAll());
    }

    /** Professors already used on this course (most-used first) — auto-fills the upload form. */
    @GetMapping("/suggested")
    public ResponseEntity<List<ProfessorResponse>> getSuggested(@RequestParam Long courseId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(2)).cachePublic())
                .body(professorService.getSuggestedForCourse(courseId));
    }

    @PostMapping
    @RateLimit(max = 5, window = 3600)
    public ResponseEntity<ProfessorResponse> create(@Valid @RequestBody CreateProfessorRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(professorService.create(request.getName()));
    }
}
