package be.freenote.dto.response;

import java.time.LocalDateTime;

/**
 * Un signalement vu par la modération. Porte assez de contexte du document pour décider SANS
 * quitter la file (titre, cours, catégorie, état de vérification, auteur) — c'est ce qui manquait :
 * l'ancienne version n'avait que l'id et le titre.
 */
public record ReportResponse(
        Long id,
        Long documentId,
        String documentTitle,
        String documentCourseName,
        String documentCategory,
        boolean documentVerified,
        // Auteur du document (username technique) — null si le compte a été supprimé.
        String documentAuthorName,
        Long documentAuthorId,
        String reporterUsername,
        Long reporterId,
        // Nature du problème (be.freenote.enums.ReportType).
        String type,
        String reason,
        String status,
        // Ce qui a été fait (be.freenote.enums.ReportResolution) — null tant que PENDING.
        String resolution,
        String resolutionNote,
        String resolvedByName,
        LocalDateTime resolvedAt,
        LocalDateTime createdAt
) {}
