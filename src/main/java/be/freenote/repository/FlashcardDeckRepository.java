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
     * Filtre cours = collection depuis V15 (équivalences), même pattern. {@code linkedCourseIds} élargit un
     * filtre SECTION par un OU (jamais un ET) : le contenu « toute la section » n'a pas de cours.
     */
    default Page<DeckListRow> findPublishedRows(java.util.Collection<Long> courseIds, Long sectionId,
                                                java.util.Collection<Long> linkedCourseIds,
                                                Long ownerId, Pageable pageable) {
        boolean allCourses = courseIds == null || courseIds.isEmpty();
        boolean withLinked = linkedCourseIds != null && !linkedCourseIds.isEmpty();
        return findPublishedRowsByCourses(allCourses, allCourses ? java.util.List.of(-1L) : courseIds,
                sectionId, withLinked, withLinked ? linkedCourseIds : java.util.List.of(-1L), ownerId, pageable);
    }

    @Query("""
        SELECT new be.freenote.dto.response.DeckListRow(
            d.id, d.title, d.description, d.cardCount, d.published, d.createdAt,
            o.id, o.username, p.displayRealName, p.firstName, p.lastName, c.id, c.name, s.id, s.name)
        FROM FlashcardDeck d LEFT JOIN d.owner o LEFT JOIN o.profile p LEFT JOIN d.course c LEFT JOIN d.section s
        WHERE d.published = true
          AND (:allCourses = true OR c.id IN :courseIds)
          AND (:sectionId IS NULL OR s.id = :sectionId OR (:withLinked = true AND c.id IN :linkedCourseIds))
          AND (:ownerId IS NULL OR o.id = :ownerId)
        ORDER BY d.createdAt DESC
        """)
    Page<DeckListRow> findPublishedRowsByCourses(@Param("allCourses") boolean allCourses,
                                                 @Param("courseIds") java.util.Collection<Long> courseIds,
                                                 @Param("sectionId") Long sectionId,
                                                 @Param("withLinked") boolean withLinked,
                                                 @Param("linkedCourseIds") java.util.Collection<Long> linkedCourseIds,
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
