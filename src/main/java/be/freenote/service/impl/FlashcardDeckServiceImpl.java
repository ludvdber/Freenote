package be.freenote.service.impl;

import be.freenote.dto.request.PublishDeckRequest;
import be.freenote.dto.response.DeckListRow;
import be.freenote.dto.response.FlashcardDeckResponse;
import be.freenote.dto.response.FlashcardDeckSummary;
import be.freenote.dto.response.PageResponse;
import be.freenote.entity.Course;
import be.freenote.entity.FlashcardCardJson;
import be.freenote.entity.FlashcardDeck;
import be.freenote.entity.Section;
import be.freenote.entity.User;
import be.freenote.exception.ForbiddenException;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.mapper.FlashcardDeckMapper;
import be.freenote.repository.CourseRepository;
import be.freenote.repository.FlashcardDeckRepository;
import be.freenote.repository.Repositories;
import be.freenote.repository.SectionRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.FlashcardDeckService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FlashcardDeckServiceImpl implements FlashcardDeckService {

    private final FlashcardDeckRepository deckRepository;
    private final UserRepository userRepository;
    private final CourseRepository courseRepository;
    private final SectionRepository sectionRepository;
    private final be.freenote.service.CourseEquivalenceService courseEquivalenceService;
    private final be.freenote.service.NotificationService notificationService;

    @Override
    @Transactional
    public FlashcardDeckResponse save(Long userId, PublishDeckRequest request) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        Course course = request.courseId() == null
                ? null
                : Repositories.findByIdOrThrow(courseRepository, request.courseId(), "Course");

        List<FlashcardCardJson> cards = buildCards(request);

        FlashcardDeck deck = FlashcardDeck.builder()
                .title(request.title().trim())
                .description(request.description() == null ? null : request.description().trim())
                .cards(cards)
                .cardCount(cards.size())
                .published(Boolean.TRUE.equals(request.published()))
                .owner(user)
                .course(course)
                .section(resolveSection(course, request.sectionId()))
                .build();

        return FlashcardDeckMapper.toResponse(deckRepository.save(deck), userId);
    }

    @Override
    @Transactional
    public FlashcardDeckResponse update(Long userId, boolean isAdmin, Long id, PublishDeckRequest request) {
        FlashcardDeck deck = Repositories.findByIdOrThrow(deckRepository, id, "FlashcardDeck");
        if (!isOwner(deck, userId) && !isAdmin) {
            throw new ForbiddenException("Vous ne pouvez modifier que vos propres paquets.");
        }
        Course course = request.courseId() == null
                ? null
                : Repositories.findByIdOrThrow(courseRepository, request.courseId(), "Course");
        List<FlashcardCardJson> cards = buildCards(request);

        deck.setTitle(request.title().trim());
        deck.setDescription(request.description() == null ? null : request.description().trim());
        deck.setCards(cards);
        deck.setCardCount(cards.size());
        deck.setCourse(course);
        deck.setSection(resolveSection(course, request.sectionId()));
        deck.setPublished(Boolean.TRUE.equals(request.published()));
        return FlashcardDeckMapper.toResponse(deckRepository.save(deck), userId);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<FlashcardDeckSummary> list(Long courseId, Long sectionId, Long ownerId, Pageable pageable, Long callerId) {
        // Équivalences (V15) : les paquets de « Stats (Compta) » remontent aussi pour « Stats (Info) »
        Page<DeckListRow> page = deckRepository.findPublishedRows(
                courseEquivalenceService.expand(courseId), sectionId, ownerId, pageable);
        return PageResponse.from(page,
                page.getContent().stream().map(r -> FlashcardDeckMapper.toSummary(r, callerId)).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<FlashcardDeckSummary> mine(Long userId, Pageable pageable) {
        Page<DeckListRow> page = deckRepository.findMineRows(userId, pageable);
        return PageResponse.from(page,
                page.getContent().stream().map(r -> FlashcardDeckMapper.toSummary(r, userId)).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public FlashcardDeckResponse get(Long id, Long callerId, boolean isAdmin) {
        FlashcardDeck deck = Repositories.findByIdOrThrow(deckRepository, id, "FlashcardDeck");
        // Un paquet privé n'est visible que de son propriétaire (ou d'un admin) — 404, jamais 403,
        // pour ne pas révéler l'existence d'un contenu privé (même pattern que les Gantt privés).
        if (!deck.isPublished() && !isOwner(deck, callerId) && !isAdmin) {
            throw new ResourceNotFoundException("FlashcardDeck", "id", id);
        }
        return FlashcardDeckMapper.toResponse(deck, callerId);
    }

    @Override
    @Transactional
    public void delete(Long userId, boolean isAdmin, Long id) {
        FlashcardDeck deck = Repositories.findByIdOrThrow(deckRepository, id, "FlashcardDeck");
        if (!isAdmin && !isOwner(deck, userId)) {
            throw new ForbiddenException("Vous ne pouvez supprimer que vos propres paquets.");
        }
        deckRepository.delete(deck);
    }

    @Override
    @Transactional
    public void unpublish(Long id) {
        FlashcardDeck deck = Repositories.findByIdOrThrow(deckRepository, id, "FlashcardDeck");
        if (!deck.isPublished()) {
            return; // déjà privé : re-cliquer ne doit ni échouer ni re-notifier
        }
        deck.setPublished(false);
        deckRepository.save(deck);
        // Même contrat que QuizServiceImpl.unpublish : le contenu redevient privé, l'auteur est prévenu.
        User owner = deck.getOwner();
        if (owner != null) {
            notificationService.push(owner.getId(), "revision.unpublished", java.util.Map.of(
                    "kind", "deck",
                    "title", deck.getTitle()));
        }
    }

    private static boolean isOwner(FlashcardDeck deck, Long userId) {
        return deck.getOwner() != null && deck.getOwner().getId().equals(userId);
    }

    /** Règle de cohérence V13 : un cours choisi impose SA section ; sans cours, la section libre
     *  (nullable) permet le paquet multi-cours « toute la section ». */
    private Section resolveSection(Course course, Long sectionId) {
        if (course != null) {
            return course.getSection();
        }
        return sectionId == null ? null : Repositories.findByIdOrThrow(sectionRepository, sectionId, "Section");
    }

    /** Trim + drop cards without a front; a deck must keep at least one valid card. */
    private static List<FlashcardCardJson> buildCards(PublishDeckRequest request) {
        List<FlashcardCardJson> cards = request.cards().stream()
                .map(c -> new FlashcardCardJson(c.front().trim(), c.back() == null ? "" : c.back().trim()))
                .filter(c -> !c.front().isBlank())
                .toList();
        if (cards.isEmpty()) {
            throw new IllegalArgumentException("Le paquet ne contient aucune carte valide.");
        }
        return cards;
    }
}
