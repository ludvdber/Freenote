package be.freenote.event;

import be.freenote.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Single source of truth for all XP reward rules.
 * Changing XP amounts or adding new rules only requires editing this class.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class XpEventListener {

    private static final int XP_DOCUMENT_VERIFIED = 10;
    private static final int XP_DOCUMENT_DOWNLOADED = 1;
    private static final int XP_PER_RATING_STAR = 2;
    /** A rating below this grants no XP — a mediocre document must not reward its author. */
    private static final int MIN_SCORE_FOR_XP = 3;
    /** Reward for the RATER's first rating on a document (validated 2026-07-07) — whatever the score:
     *  the signal « ce doc est médiocre » vaut autant pour la promo qu'un 5★. */
    private static final int XP_RATING_GIVEN = 2;

    private final UserService userService;

    @EventListener
    public void onDocumentVerified(XpEvent.DocumentVerified event) {
        userService.addXp(event.authorId(), XP_DOCUMENT_VERIFIED);
        log.debug("XP +{} to user {} (document {} verified)", XP_DOCUMENT_VERIFIED, event.authorId(), event.documentId());
    }

    @EventListener
    public void onDocumentUnverified(XpEvent.DocumentUnverified event) {
        userService.addXp(event.authorId(), -XP_DOCUMENT_VERIFIED);
        log.debug("XP -{} to user {} (document {} unverified)", XP_DOCUMENT_VERIFIED, event.authorId(), event.documentId());
    }

    @EventListener
    public void onDocumentDownloaded(XpEvent.DocumentDownloaded event) {
        userService.addXp(event.authorId(), XP_DOCUMENT_DOWNLOADED);
        log.debug("XP +{} to user {} (document {} downloaded)", XP_DOCUMENT_DOWNLOADED, event.authorId(), event.documentId());
    }

    @EventListener
    public void onDocumentRated(XpEvent.DocumentRated event) {
        // Delta between what the new and old scores are worth, so a re-rating adjusts instead of
        // stacking: 5★→2★ takes the reward back, 2★→4★ grants it late. First rating: previous = 0.
        int delta = xpForScore(event.score()) - xpForScore(event.previousScore() == null ? 0 : event.previousScore());
        if (delta == 0) {
            return;
        }
        userService.addXp(event.authorId(), delta);
        log.debug("XP {}{} to user {} (document {} rated {}★, was {})", delta > 0 ? "+" : "", delta,
                event.authorId(), event.documentId(), event.score(), event.previousScore());
    }

    @EventListener
    public void onRatingGiven(XpEvent.RatingGiven event) {
        userService.addXp(event.raterId(), XP_RATING_GIVEN);
        log.debug("XP +{} to user {} (first rating on document {})", XP_RATING_GIVEN, event.raterId(), event.documentId());
    }

    @EventListener
    public void onDocumentDeleted(XpEvent.DocumentDeleted event) {
        int xp = (event.wasVerified() ? XP_DOCUMENT_VERIFIED : 0)
                + event.ratingScores().stream().mapToInt(Integer::intValue).map(XpEventListener::xpForScore).sum();
        if (xp == 0) {
            return;
        }
        userService.addXp(event.authorId(), -xp);
        log.debug("XP -{} to user {} (document {} deleted)", xp, event.authorId(), event.documentId());
    }

    private static int xpForScore(int score) {
        return score >= MIN_SCORE_FOR_XP ? XP_PER_RATING_STAR * score : 0;
    }
}
