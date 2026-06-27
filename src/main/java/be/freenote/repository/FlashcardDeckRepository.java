package be.freenote.repository;

import be.freenote.entity.FlashcardDeck;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FlashcardDeckRepository extends JpaRepository<FlashcardDeck, Long> {

    /**
     * Newest-first listing with owner (+ profile, for the display name) and course fetch-joined in a
     * single query — avoids N+1 over the page. ManyToOne fetch joins are pagination-safe (no
     * in-memory pagination warning, unlike a collection fetch). The ORDER BY lives in the query so
     * callers pass an unsorted {@link Pageable}.
     */
    @Query(value = "SELECT d FROM FlashcardDeck d "
            + "LEFT JOIN FETCH d.owner o LEFT JOIN FETCH o.profile LEFT JOIN FETCH d.course "
            + "ORDER BY d.createdAt DESC",
            countQuery = "SELECT COUNT(d) FROM FlashcardDeck d")
    Page<FlashcardDeck> findAllForListing(Pageable pageable);

    @Query(value = "SELECT d FROM FlashcardDeck d "
            + "LEFT JOIN FETCH d.owner o LEFT JOIN FETCH o.profile LEFT JOIN FETCH d.course c "
            + "WHERE c.id = :courseId ORDER BY d.createdAt DESC",
            countQuery = "SELECT COUNT(d) FROM FlashcardDeck d WHERE d.course.id = :courseId")
    Page<FlashcardDeck> findByCourseForListing(@Param("courseId") Long courseId, Pageable pageable);
}
