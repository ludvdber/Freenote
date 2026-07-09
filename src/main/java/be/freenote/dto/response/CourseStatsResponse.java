package be.freenote.dto.response;

import java.time.LocalDateTime;

/**
 * Stats agrégées d'un cours pour le bandeau de la page cours (équivalences V15 incluses,
 * pour coller au listing qui expose déjà les docs des cours liés).
 * {@code averageRating} est null quand aucun document du cours n'a encore de note ;
 * {@code lastUploadAt} est null quand le cours n'a aucun document.
 */
public record CourseStatsResponse(
        long documentCount,
        long totalViews,
        Double averageRating,
        LocalDateTime lastUploadAt
) {}
