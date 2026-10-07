package be.freenote.repository;

import be.freenote.dto.response.DeckListRow;
import be.freenote.entity.FlashcardDeck;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FlashcardDeckRepository extends JpaRepository<FlashcardDeck, Long> {

    /**
     * Bibliothèque : paquets PUBLIÉS, plus récents d'abord, en PROJECTION (sans la colonne JSONB
     * {@code cards}) — même logique anti-heap que {@link QuizRepository#findPublishedRows}.
     * Filtre cours = collection depuis V15 (équivalences), même pattern.
     */
    default Page<DeckListRow> findPublishedRows(java.util.Collection<Long> courseIds, Long sectionId,
                                                Long ownerId, Pageable pageable) {
        boolean allCourses = courseIds == null || courseIds.isEmpty();
        return findPublishedRowsByCourses(allCourses, allCourses ? java.util.List.of(-1L) : courseIds,
                sectionId, ownerId, pageable);
    }

    @Query("""
        SELECT new be.freenote.dto.response.DeckListRow(
            d.id, d.title, d.description, d.cardCount, d.published, d.createdAt,
            o.id, o.username, p.displayRealName, p.firstName, p.lastName, c.id, c.name, s.id, s.name)
        FROM FlashcardDeck d LEFT JOIN d.owner o LEFT JOIN o.profile p LEFT JOIN d.course c LEFT JOIN d.section s
        WHERE d.published = true
          AND (:allCourses = true OR c.id IN :courseIds)
          AND (:sectionId IS NULL OR s.id = :sectionId)
          AND (:ownerId IS NULL OR o.id = :ownerId)
        ORDER BY d.createdAt DESC
        """)
    Page<DeckListRow> findPublishedRowsByCourses(@Param("allCourses") boolean allCourses,
                                                 @Param("courseIds") java.util.Collection<Long> courseIds,
                                                 @Param("sectionId") Long sectionId,
                                                 @Param("ownerId") Long ownerId,
                                                 Pageable pageable);

    /** « Mes paquets » : tous les paquets du propriétaire (privés + publiés), dernier modifié d'abord. */
    @Query("""
        SELECT new be.freenote.dto.response.DeckListRow(
            d.id, d.title, d.description, d.cardCount, d.published, d.createdAt,
            o.id, o.username, p.displayRealName, p.firstName, p.lastName, c.id, c.name, s.id, s.name)
        FROM FlashcardDeck d JOIN d.owner o LEFT JOIN o.profile p LEFT JOIN d.course c LEFT JOIN d.section s
        WHERE o.id = :ownerId
        ORDER BY d.updatedAt DESC
        """)
    Page<DeckListRow> findMineRows(@Param("ownerId") Long ownerId, Pageable pageable);
}
