package be.freenote.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Lightweight admin audit-trail row. The actor is stored both as a nullable FK ({@code actorId},
 * ON DELETE SET NULL) and a denormalized name snapshot ({@code actorName}) so the log still shows
 * who acted even after that account is deleted or banned.
 */
@Entity
@Table(name = "activity_logs")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class ActivityLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40)
    private String type;

    private Long actorId;

    private String actorName;

    private String message;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
