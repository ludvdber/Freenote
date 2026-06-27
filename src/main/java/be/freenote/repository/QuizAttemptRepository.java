package be.freenote.repository;

import be.freenote.entity.QuizAttempt;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, Long> {

    /**
     * Attempts for a quiz, best-first (score DESC, then fastest), with the user (+ profile) fetch-joined
     * to avoid N+1. The service de-duplicates by user (keeping the first = best row per user) to build
     * the leaderboard. The {@link Pageable} bounds the scan (a generous school-scale cap) so a viral
     * quiz can never load an unbounded row set; the top users still surface since they rank first.
     */
    @Query("SELECT a FROM QuizAttempt a "
            + "LEFT JOIN FETCH a.user u LEFT JOIN FETCH u.profile "
            + "WHERE a.quiz.id = :quizId "
            + "ORDER BY a.score DESC, a.durationMs ASC")
    List<QuizAttempt> findForLeaderboard(@Param("quizId") Long quizId, Pageable pageable);
}
