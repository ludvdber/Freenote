package be.freenote.dto.response;

import java.time.LocalDateTime;

/** Projection JPQL du listing des quiz : tout SAUF la colonne JSONB {@code questions} — un quiz peut
 *  légalement peser plusieurs Mo (images base64), charger l'entité entière pour une liste ferait
 *  exploser la heap. Les champs owner/profil bruts sont résolus en displayName côté mapper. */
public record QuizListRow(
        Long id,
        String title,
        String description,
        int questionCount,
        int attemptCount,
        boolean published,
        LocalDateTime createdAt,
        Long ownerId,
        String ownerUsername,
        Boolean ownerDisplayRealName,
        String ownerFirstName,
        String ownerLastName,
        Long courseId,
        String courseName
) {}
