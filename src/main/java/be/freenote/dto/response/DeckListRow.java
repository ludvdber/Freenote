package be.freenote.dto.response;

import java.time.LocalDateTime;

/** Projection JPQL du listing des paquets : tout SAUF la colonne JSONB {@code cards}
 *  (même logique que {@link QuizListRow}). */
public record DeckListRow(
        Long id,
        String title,
        String description,
        int cardCount,
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
