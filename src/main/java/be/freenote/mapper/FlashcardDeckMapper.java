package be.freenote.mapper;

import be.freenote.dto.request.FlashcardCardDto;
import be.freenote.dto.response.FlashcardDeckResponse;
import be.freenote.dto.response.FlashcardDeckSummary;
import be.freenote.entity.FlashcardDeck;
import be.freenote.entity.User;

import java.util.List;

/**
 * Static deck → DTO mapping. The owner display name honours the "show real name" preference via
 * {@link UserMapper#resolveDisplayName}; an orphaned deck (owner deleted) shows "Anonyme".
 */
public final class FlashcardDeckMapper {

    private FlashcardDeckMapper() {}

    public static FlashcardDeckSummary toSummary(FlashcardDeck d) {
        return new FlashcardDeckSummary(
                d.getId(), d.getTitle(), d.getDescription(), d.getCardCount(),
                ownerName(d), courseId(d), courseName(d), d.getCreatedAt());
    }

    public static FlashcardDeckResponse toResponse(FlashcardDeck d) {
        List<FlashcardCardDto> cards = d.getCards().stream()
                .map(c -> new FlashcardCardDto(c.front(), c.back()))
                .toList();
        return new FlashcardDeckResponse(
                d.getId(), d.getTitle(), d.getDescription(), d.getCardCount(),
                ownerName(d), courseId(d), courseName(d), d.getCreatedAt(), cards);
    }

    private static String ownerName(FlashcardDeck d) {
        User o = d.getOwner();
        return o == null ? "Anonyme" : UserMapper.resolveDisplayName(o.getProfile(), o.getUsername());
    }

    private static Long courseId(FlashcardDeck d) {
        return d.getCourse() == null ? null : d.getCourse().getId();
    }

    private static String courseName(FlashcardDeck d) {
        return d.getCourse() == null ? null : d.getCourse().getName();
    }
}
