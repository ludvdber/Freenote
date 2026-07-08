package be.freenote.service;

import be.freenote.dto.request.FlashcardCardDto;
import be.freenote.dto.request.PublishDeckRequest;
import be.freenote.dto.response.FlashcardDeckResponse;
import be.freenote.entity.FlashcardDeck;
import be.freenote.entity.User;
import be.freenote.exception.ForbiddenException;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.repository.CourseRepository;
import be.freenote.repository.FlashcardDeckRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.impl.FlashcardDeckServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FlashcardDeckServiceImplTest {

    @Mock private FlashcardDeckRepository deckRepository;
    @Mock private UserRepository userRepository;
    @Mock private CourseRepository courseRepository;
    @Mock private CourseEquivalenceService courseEquivalenceService;

    @InjectMocks private FlashcardDeckServiceImpl service;

    private User testUser(Long id) {
        return User.builder().id(id).username("user" + id).build();
    }

    private FlashcardDeck deckOwnedBy(Long ownerId) {
        return FlashcardDeck.builder().id(5L).owner(testUser(ownerId)).cards(List.of()).build();
    }

    @Test
    void shouldSaveDeckTrimmingAndCountingOnlyValidCards() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        when(deckRepository.save(any(FlashcardDeck.class))).thenAnswer(inv -> inv.getArgument(0));

        var request = new PublishDeckRequest("  Compta — TVA  ", "  ma desc  ", null, null,
                List.of(new FlashcardCardDto("  Q1  ", "  A1  "),
                        new FlashcardCardDto("Q2", null),            // null back → ""
                        new FlashcardCardDto("   ", "ignored")),      // blank front filtered out
                true);

        FlashcardDeckResponse res = service.save(1L, request);

        assertThat(res.title()).isEqualTo("Compta — TVA");
        assertThat(res.description()).isEqualTo("ma desc");
        assertThat(res.cardCount()).isEqualTo(2);
        assertThat(res.cards()).containsExactly(
                new FlashcardCardDto("Q1", "A1"),
                new FlashcardCardDto("Q2", ""));
        assertThat(res.ownerName()).isEqualTo("user1");
        assertThat(res.published()).isTrue();
        assertThat(res.owned()).isTrue();
        verify(courseRepository, never()).findById(any());  // no courseId → no course lookup
    }

    @Test
    void shouldSavePrivateDeckWhenPublishedFalse() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        when(deckRepository.save(any(FlashcardDeck.class))).thenAnswer(inv -> inv.getArgument(0));

        var request = new PublishDeckRequest("Privé", null, null, null,
                List.of(new FlashcardCardDto("Q", "A")), false);

        assertThat(service.save(1L, request).published()).isFalse();
    }

    @Test
    void shouldRejectDeckWithNoValidCard() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        var request = new PublishDeckRequest("Empty", null, null, null,
                List.of(new FlashcardCardDto("   ", "x")), true);

        assertThatThrownBy(() -> service.save(1L, request))
                .isInstanceOf(IllegalArgumentException.class);
        verify(deckRepository, never()).save(any());
    }

    @Test
    void shouldHidePrivateDeckFromNonOwner() {
        FlashcardDeck deck = FlashcardDeck.builder().id(5L).owner(testUser(2L))
                .published(false).cards(List.of()).build();
        when(deckRepository.findById(5L)).thenReturn(Optional.of(deck));

        // 404 (pas 403) : un contenu privé ne révèle pas son existence.
        assertThatThrownBy(() -> service.get(5L, 1L, false))
                .isInstanceOf(ResourceNotFoundException.class);
        // ... mais le propriétaire et l'admin y accèdent.
        assertThat(service.get(5L, 2L, false).owned()).isTrue();
        assertThat(service.get(5L, 99L, true).owned()).isFalse();
    }

    @Test
    void shouldForbidUpdatingSomeoneElsesDeck() {
        when(deckRepository.findById(5L)).thenReturn(Optional.of(deckOwnedBy(2L)));

        var request = new PublishDeckRequest("X", null, null, null,
                List.of(new FlashcardCardDto("Q", "A")), true);
        assertThatThrownBy(() -> service.update(1L, false, 5L, request))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void shouldUpdateOwnDeckIncludingPublishedFlag() {
        FlashcardDeck deck = FlashcardDeck.builder().id(5L).owner(testUser(1L))
                .published(false).cards(List.of()).build();
        when(deckRepository.findById(5L)).thenReturn(Optional.of(deck));
        when(deckRepository.save(any(FlashcardDeck.class))).thenAnswer(inv -> inv.getArgument(0));

        var request = new PublishDeckRequest("Nouveau", null, null, null,
                List.of(new FlashcardCardDto("Q1", "A1"), new FlashcardCardDto("Q2", "A2")), true);
        FlashcardDeckResponse res = service.update(1L, false, 5L, request);

        assertThat(res.title()).isEqualTo("Nouveau");
        assertThat(res.cardCount()).isEqualTo(2);
        assertThat(res.published()).isTrue();
    }

    @Test
    void shouldForbidDeletingSomeoneElsesDeck() {
        when(deckRepository.findById(5L)).thenReturn(Optional.of(deckOwnedBy(2L)));

        assertThatThrownBy(() -> service.delete(1L, false, 5L))
                .isInstanceOf(ForbiddenException.class);
        verify(deckRepository, never()).delete(any());
    }

    @Test
    void shouldLetOwnerDeleteOwnDeck() {
        FlashcardDeck deck = deckOwnedBy(2L);
        when(deckRepository.findById(5L)).thenReturn(Optional.of(deck));

        service.delete(2L, false, 5L);

        verify(deckRepository).delete(deck);
    }

    @Test
    void shouldLetAdminDeleteAnyDeck() {
        FlashcardDeck deck = deckOwnedBy(2L);
        when(deckRepository.findById(5L)).thenReturn(Optional.of(deck));

        service.delete(99L, true, 5L);

        verify(deckRepository).delete(deck);
    }
}
