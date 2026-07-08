package be.freenote.controller;

import be.freenote.dto.request.CreateQuizRequest;
import be.freenote.dto.request.SubmitAttemptRequest;
import be.freenote.dto.response.AttemptResultResponse;
import be.freenote.dto.response.QuizFullResponse;
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
 * Quiz enregistrés côté serveur. Tous les endpoints sont sous {@code /api/**} → règle globale
 * {@code anyRequest().hasRole("VERIFIED")} : créer, enregistrer, jouer et se classer sont réservés
 * aux étudiants ISFCE vérifiés. Le parcours 100 % anonyme (quiz éphémère encodé dans l'URL
 * {@code #quiz=}) ne touche jamais ce contrôleur — et n'a donc ni sauvegarde ni classement.
 * Un quiz {@code published=false} est un enregistrement privé (visible du seul propriétaire) ;
 * {@code published=true} le place dans la bibliothèque partagée.
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

    @PutMapping("/{id}")
    @RateLimit(max = 60, window = 3600)
    public ResponseEntity<QuizSummary> update(Authentication authentication, @PathVariable Long id,
                                              @Valid @RequestBody CreateQuizRequest request) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.ok(service.update(userId, isAdmin(authentication), id, request));
    }

    /** Bibliothèque : quiz publiés uniquement. Public (lecture + jeu hors classement pour les
     *  anonymes) ; {@code ownerId} filtre les quiz publiés d'un utilisateur (section du profil). */
    @GetMapping
    public ResponseEntity<PageResponse<QuizSummary>> list(
            Authentication authentication,
            @RequestParam(required = false) Long courseId,
            @RequestParam(required = false) Long sectionId,
            @RequestParam(required = false) Long ownerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Long callerId = SecurityUtils.currentUserIdOrNull(authentication);
        return ResponseEntity.ok(service.list(courseId, sectionId, ownerId, pageable(page, size), callerId));
    }

    /** « Mes quiz » : tout ce que le compte a enregistré (privés + publiés). */
    @GetMapping("/mine")
    public ResponseEntity<PageResponse<QuizSummary>> mine(
            Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.ok(service.mine(userId, pageable(page, size)));
    }

    @GetMapping("/{id}/play")
    public ResponseEntity<QuizPlayResponse> play(Authentication authentication, @PathVariable Long id) {
        return ResponseEntity.ok(service.play(id, SecurityUtils.currentUserIdOrNull(authentication), isAdmin(authentication)));
    }

    /** Vue complète (réponses incluses) — édition par le propriétaire, import depuis la bibliothèque. */
    @GetMapping("/{id}/full")
    public ResponseEntity<QuizFullResponse> full(Authentication authentication, @PathVariable Long id) {
        return ResponseEntity.ok(service.full(id, SecurityUtils.currentUserId(authentication), isAdmin(authentication)));
    }

    /** Correction serveur d'une partie. Sans compte VÉRIFIÉ ({@code userId} null) : corrigé mais
     *  RIEN n'est enregistré — pas d'essai, pas de rang (le classement reste réservé aux étudiants ;
     *  un compte pré-onboarding joue comme un anonyme, son pseudo placeholder n'y apparaît jamais).
     *  Le compteur de popularité est bumpé dans tous les cas. */
    @PostMapping("/{id}/attempts")
    @RateLimit(max = 60, window = 3600)
    public ResponseEntity<AttemptResultResponse> submit(Authentication authentication,
                                                        @PathVariable Long id,
                                                        @Valid @RequestBody SubmitAttemptRequest request) {
        Long userId = isVerified(authentication) ? SecurityUtils.currentUserIdOrNull(authentication) : null;
        return ResponseEntity.ok(service.submit(userId, id, request));
    }

    @GetMapping("/{id}/leaderboard")
    public ResponseEntity<List<QuizLeaderboardEntry>> leaderboard(Authentication authentication,
                                                                  @PathVariable Long id,
                                                                  @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(service.leaderboard(id, size,
                SecurityUtils.currentUserId(authentication), isAdmin(authentication)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(Authentication authentication, @PathVariable Long id) {
        Long userId = SecurityUtils.currentUserId(authentication);
        service.delete(userId, isAdmin(authentication), id);
        return ResponseEntity.noContent().build();
    }

    /** « Signaler une erreur » sur une question (écran de fin de partie) → notification à l'auteur.
     *  Hors du matcher permitAll de {@code /attempts} : réservé aux VÉRIFIÉS (règle globale). */
    @PostMapping("/{id}/report-question")
    @RateLimit(max = 5, window = 3600)
    public ResponseEntity<Void> reportQuestion(Authentication authentication, @PathVariable Long id,
                                               @Valid @RequestBody be.freenote.dto.request.ReportQuizQuestionRequest request) {
        service.reportQuestion(SecurityUtils.currentUserId(authentication), id, request);
        return ResponseEntity.noContent().build();
    }

    private static Pageable pageable(int page, int size) {
        return PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), MAX_PAGE_SIZE));
    }

    private static boolean isAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    private static boolean isVerified(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_VERIFIED") || a.getAuthority().equals("ROLE_ADMIN"));
    }
}
