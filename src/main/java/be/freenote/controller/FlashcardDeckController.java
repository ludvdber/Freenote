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
 * Paquets de flashcards enregistrés côté serveur. Tous les endpoints sont sous {@code /api/**} →
 * règle globale {@code anyRequest().hasRole("VERIFIED")}. Un paquet {@code published=false} est un
 * enregistrement privé (backup du localStorage, visible du seul propriétaire) ; {@code published=true}
 * le place dans la bibliothèque partagée, importable (copie locale éditable) par tout vérifié.
 * Les anonymes utilisent l'outil 100 % côté client (localStorage + export fichier) et n'atteignent
 * jamais ce contrôleur.
 */
@RestController
@RequestMapping("/api/flashcard-decks")
@RequiredArgsConstructor
public class FlashcardDeckController {

    private static final int MAX_PAGE_SIZE = 50;

    private final FlashcardDeckService service;

    @PostMapping
    @RateLimit(max = 10, window = 3600)
    public ResponseEntity<FlashcardDeckResponse> save(Authentication authentication,
                                                      @Valid @RequestBody PublishDeckRequest request) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.status(HttpStatus.CREATED).body(service.save(userId, request));
    }

    @PutMapping("/{id}")
    @RateLimit(max = 60, window = 3600)
    public ResponseEntity<FlashcardDeckResponse> update(Authentication authentication, @PathVariable Long id,
                                                        @Valid @RequestBody PublishDeckRequest request) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.ok(service.update(userId, isAdmin(authentication), id, request));
    }

    /** Bibliothèque : paquets publiés uniquement. Public (lecture + import local pour les
     *  anonymes) ; {@code ownerId} filtre les paquets publiés d'un utilisateur (section du profil). */
    @GetMapping
    public ResponseEntity<PageResponse<FlashcardDeckSummary>> list(
            Authentication authentication,
            @RequestParam(required = false) Long courseId,
            @RequestParam(required = false) Long sectionId,
            @RequestParam(required = false) Long ownerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Long callerId = SecurityUtils.currentUserIdOrNull(authentication);
        return ResponseEntity.ok(service.list(courseId, sectionId, ownerId, pageable(page, size), callerId));
    }

    /** « Mes paquets » : tout ce que le compte a enregistré (privés + publiés). */
    @GetMapping("/mine")
    public ResponseEntity<PageResponse<FlashcardDeckSummary>> mine(
            Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.ok(service.mine(userId, pageable(page, size)));
    }

    /** Paquet complet (cartes incluses). Public pour un paquet PUBLIÉ — l'import anonyme copie les
     *  cartes en localStorage ; un paquet privé reste introuvable (404) pour tout autre appelant. */
    @GetMapping("/{id}")
    public ResponseEntity<FlashcardDeckResponse> get(Authentication authentication, @PathVariable Long id) {
        return ResponseEntity.ok(service.get(id, SecurityUtils.currentUserIdOrNull(authentication), isAdmin(authentication)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(Authentication authentication, @PathVariable Long id) {
        Long userId = SecurityUtils.currentUserId(authentication);
        service.delete(userId, isAdmin(authentication), id);
        return ResponseEntity.noContent().build();
    }

    private static Pageable pageable(int page, int size) {
        return PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), MAX_PAGE_SIZE));
    }

    private static boolean isAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }
}
