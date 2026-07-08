package be.freenote.mapper;

import be.freenote.dto.request.FlashcardCardDto;
import be.freenote.dto.response.DeckListRow;
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

    /** From the light JPQL projection (listings) — no JSONB loaded. */
    public static FlashcardDeckSummary toSummary(DeckListRow r, Long callerId) {
        String ownerName = r.ownerUsername() == null
                ? "Anonyme"
                : UserMapper.resolveDisplayName(r.ownerDisplayRealName(), r.ownerFirstName(), r.ownerLastName(), r.ownerUsername());
        boolean owned = r.ownerId() != null && r.ownerId().equals(callerId);
        return new FlashcardDeckSummary(
                r.id(), r.title(), r.description(), r.cardCount(),
                ownerName, r.courseId(), r.courseName(), r.sectionId(), r.sectionName(),
                r.createdAt(), r.published(), owned);
    }

    public static FlashcardDeckResponse toResponse(FlashcardDeck d, Long callerId) {
        List<FlashcardCardDto> cards = d.getCards().stream()
                .map(c -> new FlashcardCardDto(c.front(), c.back()))
                .toList();
        boolean owned = d.getOwner() != null && d.getOwner().getId().equals(callerId);
        return new FlashcardDeckResponse(
                d.getId(), d.getTitle(), d.getDescription(), d.getCardCount(),
                ownerName(d), courseId(d), courseName(d), sectionId(d), sectionName(d),
                d.getCreatedAt(), cards, d.isPublished(), owned);
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

    private static Long sectionId(FlashcardDeck d) {
        return d.getSection() == null ? null : d.getSection().getId();
    }

    private static String sectionName(FlashcardDeck d) {
        return d.getSection() == null ? null : d.getSection().getName();
    }
}
