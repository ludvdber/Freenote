package be.freenote.repository;

import be.freenote.dto.response.QuizListRow;
import be.freenote.entity.Quiz;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface QuizRepository extends JpaRepository<Quiz, Long> {

    /**
     * Atomic popularity bump, so concurrent submits can't lose an increment (a read-modify-write on the
     * entity would). Done in SQL — the in-memory entity isn't refreshed, which is fine: callers don't
     * read {@code attemptCount} back in the same transaction.
     */
    @Modifying
    @Query("UPDATE Quiz q SET q.attemptCount = q.attemptCount + 1 WHERE q.id = :id")
    void incrementAttemptCount(@Param("id") Long id);

    /**
     * Bibliothèque : quiz PUBLIÉS, plus récents d'abord, en PROJECTION (sans la colonne JSONB
     * {@code questions} — un quiz peut peser plusieurs Mo d'images base64, charger l'entité entière
     * pour une liste ferait exploser la heap). LEFT JOIN owner/profile/course : un seul SELECT.
     */
    @Query("""
        SELECT new be.freenote.dto.response.QuizListRow(
            q.id, q.title, q.description, q.questionCount, q.attemptCount, q.published, q.createdAt,
            o.id, o.username, p.displayRealName, p.firstName, p.lastName, c.id, c.name)
        FROM Quiz q LEFT JOIN q.owner o LEFT JOIN o.profile p LEFT JOIN q.course c
        WHERE q.published = true AND (:courseId IS NULL OR c.id = :courseId)
        ORDER BY q.createdAt DESC
        """)
    Page<QuizListRow> findPublishedRows(@Param("courseId") Long courseId, Pageable pageable);

    /** « Mes quiz » : tous les quiz du propriétaire (privés + publiés), dernier modifié d'abord. */
    @Query("""
        SELECT new be.freenote.dto.response.QuizListRow(
            q.id, q.title, q.description, q.questionCount, q.attemptCount, q.published, q.createdAt,
            o.id, o.username, p.displayRealName, p.firstName, p.lastName, c.id, c.name)
        FROM Quiz q JOIN q.owner o LEFT JOIN o.profile p LEFT JOIN q.course c
        WHERE o.id = :ownerId
        ORDER BY q.updatedAt DESC
        """)
    Page<QuizListRow> findMineRows(@Param("ownerId") Long ownerId, Pageable pageable);
}
