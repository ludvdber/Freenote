package be.freenote.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;

/**
 * A Gantt project saved by a verified user. {@code shared=false} = private (only the owner sees it);
 * {@code shared=true} = visible in the shared library to other verified students. Tasks are a JSONB
 * array (read/written as a whole). Owner is nullable (ON DELETE SET NULL) so a shared chart survives
 * the owner's deletion — same convention as documents/quizzes/flashcard_decks.
 */
@Entity
@Table(name = "gantt_charts")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class GanttChart {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String title;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private List<GanttTaskJson> tasks = List.of();

    @Column(name = "task_count", nullable = false)
    private int taskCount;

    @Column(nullable = false)
    private boolean shared;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "owner_id")
    private User owner;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
