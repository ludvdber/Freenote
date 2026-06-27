package be.freenote.dto.response;

import java.time.LocalDateTime;

/** List-view projection of a shared deck — no card payload, to keep listings light. */
public record FlashcardDeckSummary(
        Long id,
        String title,
        String description,
        int cardCount,
        String ownerName,
        Long courseId,
        String courseName,
        LocalDateTime createdAt
) {}
