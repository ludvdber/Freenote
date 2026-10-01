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

    /**
     * « Ce qui manque » : les cours sans aucun document. Au-dessus de la liste du frontend, c'est
     * un appel au dépôt là où le besoin est réel ; pour les moteurs, une page qui nomme des cours
     * que personne d'autre ne liste. Cache 1 h : le catalogue bouge au rythme des dépôts.
     */
    @GetMapping("/gaps")
    public ResponseEntity<be.freenote.dto.response.CatalogueGapsResponse> gaps() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .body(service.getCatalogueGaps());
    }

    @GetMapping("/{id}")
    public ResponseEntity<PublicCourseResponse> get(@PathVariable Long id) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(service.getCourse(id));
    }
}
