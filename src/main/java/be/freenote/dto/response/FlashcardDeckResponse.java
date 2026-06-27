package be.freenote.dto.response;

import be.freenote.dto.request.FlashcardCardDto;

import java.time.LocalDateTime;
import java.util.List;

/** Full deck (with cards) — returned on publish and when opening a shared deck to import it. */
public record FlashcardDeckResponse(
        Long id,
        String title,
        String description,
        int cardCount,
        String ownerName,
        Long courseId,
        String courseName,
        LocalDateTime createdAt,
        List<FlashcardCardDto> cards
) {}
