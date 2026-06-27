package be.freenote.service.impl;

import be.freenote.dto.request.PublishDeckRequest;
import be.freenote.dto.response.FlashcardDeckResponse;
import be.freenote.dto.response.FlashcardDeckSummary;
import be.freenote.dto.response.PageResponse;
import be.freenote.entity.Course;
import be.freenote.entity.FlashcardCardJson;
import be.freenote.entity.FlashcardDeck;
import be.freenote.entity.User;
import be.freenote.exception.ForbiddenException;
import be.freenote.mapper.FlashcardDeckMapper;
import be.freenote.repository.CourseRepository;
import be.freenote.repository.FlashcardDeckRepository;
import be.freenote.repository.Repositories;
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

    @Override
    @Transactional
    public FlashcardDeckResponse publish(Long userId, PublishDeckRequest request) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        Course course = request.courseId() == null
                ? null
                : Repositories.findByIdOrThrow(courseRepository, request.courseId(), "Course");

        List<FlashcardCardJson> cards = request.cards().stream()
                .map(c -> new FlashcardCardJson(c.front().trim(), c.back() == null ? "" : c.back().trim()))
                .filter(c -> !c.front().isBlank())
                .toList();
        if (cards.isEmpty()) {
            throw new IllegalArgumentException("Le paquet ne contient aucune carte valide.");
        }

        FlashcardDeck deck = FlashcardDeck.builder()
                .title(request.title().trim())
                .description(request.description() == null ? null : request.description().trim())
                .cards(cards)
                .cardCount(cards.size())
                .owner(user)
                .course(course)
                .build();

        return FlashcardDeckMapper.toResponse(deckRepository.save(deck));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<FlashcardDeckSummary> list(Long courseId, Pageable pageable) {
        Page<FlashcardDeck> page = courseId == null
                ? deckRepository.findAllForListing(pageable)
                : deckRepository.findByCourseForListing(courseId, pageable);
        return PageResponse.from(page, page.getContent().stream().map(FlashcardDeckMapper::toSummary).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public FlashcardDeckResponse get(Long id) {
        return FlashcardDeckMapper.toResponse(Repositories.findByIdOrThrow(deckRepository, id, "FlashcardDeck"));
    }

    @Override
    @Transactional
    public void delete(Long userId, boolean isAdmin, Long id) {
        FlashcardDeck deck = Repositories.findByIdOrThrow(deckRepository, id, "FlashcardDeck");
        boolean isOwner = deck.getOwner() != null && deck.getOwner().getId().equals(userId);
        if (!isAdmin && !isOwner) {
            throw new ForbiddenException("Vous ne pouvez supprimer que vos propres paquets.");
        }
        deckRepository.delete(deck);
    }
}
