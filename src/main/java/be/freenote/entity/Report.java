package be.freenote.entity;

import be.freenote.enums.ReportResolution;
import be.freenote.enums.ReportStatus;
import be.freenote.enums.ReportType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "reports", uniqueConstraints = @UniqueConstraint(columnNames = {"document_id", "user_id"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private Document document;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "user_id")
    private User user;

    /** Message libre de l'étudiant — TOUJOURS exigé : c'est lui qui rend le signalement actionnable
     *  (le type seul dit « il y a un souci », pas lequel). Stocké BRUT, React échappe au rendu. */
    @Column(nullable = false)
    private String reason;

    /** Nature du problème (V19) — pilote le tri de la file admin. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    @Builder.Default
    private ReportType type = ReportType.AUTRE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ReportStatus status = ReportStatus.PENDING;

    // --- Décision de modération (V19) : renseignée en sortant de la file, null tant que PENDING ---

    /** Ce qui a réellement été fait du document. */
    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private ReportResolution resolution;

    /** Mot de l'admin, repris tel quel dans la notification envoyée au signaleur. */
    @Column(name = "resolution_note", length = 500)
    private String resolutionNote;

    /** Qui a tranché — nullable : la trace survit à la suppression du compte admin. */
    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "resolved_by")
    private User resolvedBy;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
