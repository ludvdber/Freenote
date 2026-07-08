package be.freenote.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;

/**
 * A quiz PUBLISHED to the shared catalogue. Private quizzes stay client-side (localStorage) and can be
 * shared as an ephemeral URL-encoded payload without ever hitting the backend; only published ones are
 * persisted here. Questions live as a JSONB array (read/written as a whole, never queried individually).
 */
@Entity
@Table(name = "quizzes")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class Quiz {

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
    private List<QuizQuestionJson> questions = List.of();

    @Column(name = "question_count", nullable = false)
    private int questionCount;

    /** Denormalised popularity counter, bumped on each saved attempt. */
    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;

    /** Nullable: quiz survives the owner's deletion (anonymised), like shared documents/decks. */
    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "owner_id")
    private User owner;

    /** Optional link to a course; SET NULL if the course is deleted. */
    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "course_id")
    private Course course;

    /** Optional link to a section (quiz « toute la section », multi-cours) — V13. When a course
     *  is set, the service forces this to the course's section (coherence rule). */
    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "section_id")
    private Section section;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /** false = quiz privé enregistré sur le compte (visible du seul propriétaire),
     *  true = publié dans la bibliothèque partagée (jouable + classement). */
    @Column(nullable = false)
    @Builder.Default
    private boolean published = true;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
