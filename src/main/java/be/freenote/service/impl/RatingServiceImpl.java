package be.freenote.service.impl;

import be.freenote.entity.Document;
import be.freenote.entity.Rating;
import be.freenote.entity.User;
import be.freenote.event.XpEvent;
import be.freenote.exception.ForbiddenException;
import be.freenote.repository.DocumentRepository;
import be.freenote.repository.RatingRepository;
import be.freenote.repository.Repositories;
import be.freenote.repository.UserRepository;
import be.freenote.service.RatingService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class RatingServiceImpl implements RatingService {

    private final RatingRepository ratingRepository;
    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public void rate(Long userId, Long documentId, int score) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        Document document = Repositories.findByIdOrThrow(documentRepository, documentId, "Document");
        // Capture the author before recalcRatingStats clears the persistence context (lazy guard).
        Long authorId = document.getUser() != null ? document.getUser().getId() : null;

        // Refuse self-rating: it would farm XP for the author (XpEvent.DocumentRated) AND inflate the
        // document's average_rating. Mirrors the self-download guard in DocumentServiceImpl.download.
        if (authorId != null && authorId.equals(userId)) {
            throw new ForbiddenException("Vous ne pouvez pas noter votre propre document");
        }

        Optional<Rating> existing = ratingRepository.findByDocumentIdAndUserId(documentId, userId);
        Integer previousScore = existing.map(Rating::getScore).orElse(null);

        if (existing.isEmpty()) {
            ratingRepository.save(Rating.builder()
                    .document(document)
                    .user(user)
                    .score(score)
                    .build());
        } else {
            existing.get().setScore(score);
            ratingRepository.save(existing.get());
        }

        // Recompute denormalized counters from the ratings table: exact (no rounding drift) and
        // atomic under concurrent votes, unlike the previous read-modify-write on a rounded value.
        documentRepository.recalcRatingStats(documentId);

        // XP : le listener calcule le DELTA entre nouvelle et ancienne note (previousScore null =
        // première note). Re-noter ajuste donc l'XP au lieu de l'empiler (anti-farming), et une note
        // < 3 ne rapporte rien (un doc médiocre ne récompense pas son auteur).
        if (authorId != null && !Integer.valueOf(score).equals(previousScore)) {
            eventPublisher.publishEvent(new XpEvent.DocumentRated(authorId, documentId, score, previousScore));
        }
    }

    @Override
    public Double getAverageRating(Long documentId) {
        Document document = Repositories.findByIdOrThrow(documentRepository, documentId, "Document");
        return document.getAverageRating().doubleValue();
    }

    @Override
    public int getUserScore(Long userId, Long documentId) {
        return ratingRepository.findByDocumentIdAndUserId(documentId, userId)
                .map(Rating::getScore)
                .orElse(0);
    }

}
