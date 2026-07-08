package be.freenote.service;

import be.freenote.dto.request.CreateQuizRequest;
import be.freenote.dto.request.SubmitAttemptRequest;
import be.freenote.dto.response.AttemptResultResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.dto.response.QuizFullResponse;
import be.freenote.dto.response.QuizLeaderboardEntry;
import be.freenote.dto.response.QuizPlayResponse;
import be.freenote.dto.response.QuizSummary;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface QuizService {

    /** Enregistre un quiz sur le compte (privé) ou le publie dans la bibliothèque, selon {@code published}. */
    QuizSummary create(Long userId, CreateQuizRequest request);

    /** Met à jour un quiz possédé (titre, questions, cours, statut publié). Admin : modération. */
    QuizSummary update(Long userId, boolean isAdmin, Long id, CreateQuizRequest request);

    /** Bibliothèque : quiz publiés uniquement. {@code callerId} (nullable — accès anonyme) sert à
     *  marquer {@code owned} ; {@code ownerId} filtre les quiz publiés d'un utilisateur (profil). */
    PageResponse<QuizSummary> list(Long courseId, Long sectionId, Long ownerId, Pageable pageable, Long callerId);

    /** « Mes quiz » : tous les quiz du compte (privés + publiés), dernier modifié d'abord. */
    PageResponse<QuizSummary> mine(Long userId, Pageable pageable);

    /** Questions WITHOUT the answers — the playable view. Un quiz privé n'est jouable que par son
     *  propriétaire (404 sinon, comme les Gantt privés). */
    QuizPlayResponse play(Long id, Long callerId, boolean isAdmin);

    /** Vue complète RÉPONSES INCLUSES — propriétaire/admin, ou n'importe quel vérifié si publié
     *  (bouton « Importer » de la bibliothèque). */
    QuizFullResponse full(Long id, Long callerId, boolean isAdmin);

    /** Grade a finished play server-side and persist the attempt. {@code userId} null = joueur
     *  anonyme : corrigé mais rien n'est persisté (pas d'essai, rang 0 — hors classement). */
    AttemptResultResponse submit(Long userId, Long quizId, SubmitAttemptRequest request);

    /** Best attempt per user, ranked (score DESC, duration ASC), capped to {@code size}. */
    List<QuizLeaderboardEntry> leaderboard(Long quizId, int size, Long callerId, boolean isAdmin);

    /** Delete a quiz — allowed for its owner or an admin (moderation). */
    void delete(Long userId, boolean isAdmin, Long id);

    /** Signale une erreur possible dans une question d'un quiz publié → notification à l'auteur.
     *  Silencieux si le quiz est orphelin ou si le signaleur est l'auteur lui-même. */
    void reportQuestion(Long reporterId, Long quizId, be.freenote.dto.request.ReportQuizQuestionRequest request);
}
