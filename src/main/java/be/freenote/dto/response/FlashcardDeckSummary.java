package be.freenote.dto.response;

import java.time.LocalDateTime;

/** List-view projection of a deck — no card payload, to keep listings light.
 *  {@code owned}/{@code published} : mêmes sémantiques que {@link QuizSummary}. */
public record FlashcardDeckSummary(
        Long id,
        String title,
        String description,
        int cardCount,
        String ownerName,
        Long courseId,
        String courseName,
        LocalDateTime createdAt,
        boolean published,
        boolean owned
) {}
