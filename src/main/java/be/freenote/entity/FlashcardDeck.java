package be.freenote.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;

/**
 * A flashcard deck PUBLISHED to the shared catalogue (palier C). Private decks stay client-side
 * (localStorage); only published ones are persisted here. The cards live as a JSONB array — they are
 * always read/written as a whole deck, never queried individually, so no child table.
 */
@Entity
@Table(name = "flashcard_decks")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class FlashcardDeck {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(length = 500)
    private String description;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private List<FlashcardCardJson> cards = List.of();

    @Column(name = "card_count", nullable = false)
    private int cardCount;

    /** Nullable: deck survives the owner's deletion (anonymised), like shared documents. */
    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "owner_id")
    private User owner;

    /** Optional link to a course; SET NULL if the course is deleted. */
    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "course_id")
    private Course course;

    /** Optional link to a section (paquet « toute la section », multi-cours) — V13. When a course
     *  is set, the service forces this to the course's section (coherence rule). */
    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "section_id")
    private Section section;

    /** false = paquet privé enregistré sur le compte (visible du seul propriétaire),
     *  true = publié dans la bibliothèque partagée. */
    @Column(nullable = false)
    @Builder.Default
    private boolean published = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
