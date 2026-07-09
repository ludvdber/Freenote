package be.freenote.controller;

import be.freenote.dto.response.PublicCourseResponse;
import be.freenote.service.PublicDocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * Teaser public d'un cours — la page /courses/{id} devient bi-mode (comme /documents/{id}) :
 * un anonyme voit nom + section + compteurs + les docs des catégories publiques, avec CTA de
 * connexion. GET-{@code permitAll} via /api/public/** — c'est la surface SEO des cours.
 */
@RestController
@RequestMapping("/api/public/courses")
@RequiredArgsConstructor
public class PublicCourseController {

    private final PublicDocumentService service;

    @GetMapping("/{id}")
    public ResponseEntity<PublicCourseResponse> get(@PathVariable Long id) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(service.getCourse(id));
    }
}
