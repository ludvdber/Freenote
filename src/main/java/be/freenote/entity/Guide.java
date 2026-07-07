package be.freenote.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * An admin-authored guide/tutorial (e.g. "How to use bit shifting in Java"). Public, indexable
 * content (SEO + AdSense) — there is no student-facing write path. {@code content} is raw Markdown,
 * rendered + sanitised on the client. {@code slug} is the stable public URL and is generated once at
 * creation (never changed on edit, so links stay permanent). {@code authorName} is a snapshot so the
 * guide survives the author's deletion (FK is ON DELETE SET NULL, like documents/quizzes/decks).
 */
@Entity
@Table(name = "guides")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class Guide {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 160)
    private String slug;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(length = 300)
    private String summary;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    /** Free-text topic tag, e.g. "Java", "Réseaux". */
    @Column(length = 40)
    private String category;

    /** Optional /outils tool slug the guide trains with (e.g. "calculateur-ipv4"). V12. */
    @Column(name = "related_tool", length = 40)
    private String relatedTool;

    /** Draft (false) is hidden from the public list/detail; visible only in the admin panel. */
    @Column(nullable = false)
    private boolean published;

    /** Nullable: the guide survives the author's deletion (anonymised via the name snapshot). */
    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "author_id")
    private User author;

    @Column(name = "author_name", nullable = false, length = 60)
    private String authorName;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
