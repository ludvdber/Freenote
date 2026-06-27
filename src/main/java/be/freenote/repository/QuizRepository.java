package be.freenote.repository;

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
     * Newest-first listing with owner (+ profile, for the display name) and course fetch-joined in a
     * single query — avoids N+1 over the page. ManyToOne fetch joins are pagination-safe. The ORDER BY
     * lives in the query so callers pass an unsorted {@link Pageable}.
     */
    @Query(value = "SELECT q FROM Quiz q "
            + "LEFT JOIN FETCH q.owner o LEFT JOIN FETCH o.profile LEFT JOIN FETCH q.course "
            + "ORDER BY q.createdAt DESC",
            countQuery = "SELECT COUNT(q) FROM Quiz q")
    Page<Quiz> findAllForListing(Pageable pageable);

    @Query(value = "SELECT q FROM Quiz q "
            + "LEFT JOIN FETCH q.owner o LEFT JOIN FETCH o.profile LEFT JOIN FETCH q.course c "
            + "WHERE c.id = :courseId ORDER BY q.createdAt DESC",
            countQuery = "SELECT COUNT(q) FROM Quiz q WHERE q.course.id = :courseId")
    Page<Quiz> findByCourseForListing(@Param("courseId") Long courseId, Pageable pageable);
}
