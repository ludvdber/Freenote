package be.freenote.event;

import be.freenote.service.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** Barème XP (source de vérité unique) : +10 vérif / -10 unverify / +1 download /
 *  2×score si note ≥ 3 (delta au re-vote) / reprise totale à la suppression. */
@ExtendWith(MockitoExtension.class)
class XpEventListenerTest {

    @Mock private UserService userService;
    @InjectMocks private XpEventListener listener;

    @Test
    void verifiedGrantsTenXp() {
        listener.onDocumentVerified(new XpEvent.DocumentVerified(1L, 100L, "Doc"));
        verify(userService).addXp(1L, 10);
    }

    @Test
    void unverifiedTakesTenXpBack() {
        listener.onDocumentUnverified(new XpEvent.DocumentUnverified(1L, 100L));
        verify(userService).addXp(1L, -10);
    }

    @Test
    void downloadGrantsOneXp() {
        listener.onDocumentDownloaded(new XpEvent.DocumentDownloaded(1L, 100L));
        verify(userService).addXp(1L, 1);
    }

    @Test
    void firstRatingAtOrAboveThreeGrantsTwiceTheScore() {
        listener.onDocumentRated(new XpEvent.DocumentRated(1L, 100L, 4, null));
        verify(userService).addXp(1L, 8);
    }

    @Test
    void ratingBelowThreeGrantsNothing() {
        // Une note ≤ 2 ne récompense pas un document médiocre (règle 2026-07-06).
        listener.onDocumentRated(new XpEvent.DocumentRated(1L, 100L, 2, null));
        verify(userService, never()).addXp(anyLong(), anyInt());
    }

    @Test
    void firstRatingGivenGrantsTwoXpToTheRater() {
        // Règle validée 2026-07-07 : motiver la notation — le NOTEUR touche +2 à sa première note
        // sur un doc, quel que soit le score (un 1★ informe la promo autant qu'un 5★).
        listener.onRatingGiven(new XpEvent.RatingGiven(7L, 100L));
        verify(userService).addXp(7L, 2);
    }

    @Test
    void reRatingAdjustsByDelta() {
        // 5★ (=10 XP) re-noté 3★ (=6 XP) → delta -4.
        listener.onDocumentRated(new XpEvent.DocumentRated(1L, 100L, 3, 5));
        verify(userService).addXp(1L, -4);
    }

    @Test
    void reRatingFromMediocreToGoodGrantsLate() {
        // 2★ (=0 XP) re-noté 4★ (=8 XP) → +8.
        listener.onDocumentRated(new XpEvent.DocumentRated(1L, 100L, 4, 2));
        verify(userService).addXp(1L, 8);
    }

    @Test
    void deletionTakesBackVerificationAndRatingXp() {
        // Doc vérifié (+10) noté 5★ (+10) et 2★ (+0) → -20 à la suppression.
        listener.onDocumentDeleted(new XpEvent.DocumentDeleted(1L, 100L, true, List.of(5, 2)));
        verify(userService).addXp(1L, -20);
    }

    @Test
    void deletionOfUnverifiedUnratedDocTakesNothing() {
        listener.onDocumentDeleted(new XpEvent.DocumentDeleted(1L, 100L, false, List.of()));
        verify(userService, never()).addXp(anyLong(), anyInt());
    }
}
