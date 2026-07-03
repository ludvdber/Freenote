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
     */
    @Query("""
        SELECT new be.freenote.dto.response.DeckListRow(
            d.id, d.title, d.description, d.cardCount, d.published, d.createdAt,
            o.id, o.username, p.displayRealName, p.firstName, p.lastName, c.id, c.name)
        FROM FlashcardDeck d LEFT JOIN d.owner o LEFT JOIN o.profile p LEFT JOIN d.course c
        WHERE d.published = true AND (:courseId IS NULL OR c.id = :courseId)
        ORDER BY d.createdAt DESC
        """)
    Page<DeckListRow> findPublishedRows(@Param("courseId") Long courseId, Pageable pageable);

    /** « Mes paquets » : tous les paquets du propriétaire (privés + publiés), dernier modifié d'abord. */
    @Query("""
        SELECT new be.freenote.dto.response.DeckListRow(
            d.id, d.title, d.description, d.cardCount, d.published, d.createdAt,
            o.id, o.username, p.displayRealName, p.firstName, p.lastName, c.id, c.name)
        FROM FlashcardDeck d JOIN d.owner o LEFT JOIN o.profile p LEFT JOIN d.course c
        WHERE o.id = :ownerId
        ORDER BY d.updatedAt DESC
        """)
    Page<DeckListRow> findMineRows(@Param("ownerId") Long ownerId, Pageable pageable);
}
