package be.freenote.dto.response;

import be.freenote.dto.request.FlashcardCardDto;

import java.time.LocalDateTime;
import java.util.List;

/** Full deck (with cards) — returned on save/publish and when opening a deck to study or import it. */
public record FlashcardDeckResponse(
        Long id,
        String title,
        String description,
        int cardCount,
        String ownerName,
        Long courseId,
        String courseName,
        Long sectionId,
        String sectionName,
        LocalDateTime createdAt,
        List<FlashcardCardDto> cards,
        boolean published,
        boolean owned
) {}
