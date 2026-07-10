package be.freenote.controller;

import be.freenote.dto.response.ModerationQueueResponse;
import be.freenote.service.AnalyticsService;
import be.freenote.service.FlashcardDeckService;
import be.freenote.service.QuizService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints de modération accessibles aux ADMIN **et** MODÉRATEURS (V18) — voir les matchers
 * dédiés de SecurityConfig ({@code /api/admin/moderation/**}, {@code /api/admin/quizzes/**},
 * {@code /api/admin/flashcard-decks/**}) + la re-vérification live d'AdminRoleVerificationFilter.
 * La dépublication retire un quiz/paquet de la bibliothèque publique sans le détruire : il
 * redevient un enregistrement privé de son auteur (notifié) — l'outil qui manquait depuis la
 * révision publique (n'importe quel vérifié publie, personne ne pouvait retirer).
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminModerationController {

    private final AnalyticsService analyticsService;
    private final QuizService quizService;
    private final FlashcardDeckService deckService;

    /** Badges de la sidebar pour un modérateur (l'admin les tire de la vue d'ensemble complète). */
    @GetMapping("/moderation/queue")
    public ResponseEntity<ModerationQueueResponse> queue() {
        return ResponseEntity.ok(analyticsService.getModerationQueue());
    }

    @PutMapping("/quizzes/{id}/unpublish")
    public ResponseEntity<Void> unpublishQuiz(@PathVariable Long id) {
        quizService.unpublish(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/flashcard-decks/{id}/unpublish")
    public ResponseEntity<Void> unpublishDeck(@PathVariable Long id) {
        deckService.unpublish(id);
        return ResponseEntity.noContent().build();
    }
}
