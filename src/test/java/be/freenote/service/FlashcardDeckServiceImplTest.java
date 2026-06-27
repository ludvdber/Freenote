package be.freenote.service;

import be.freenote.dto.request.FlashcardCardDto;
import be.freenote.dto.request.PublishDeckRequest;
import be.freenote.dto.response.FlashcardDeckResponse;
import be.freenote.entity.FlashcardDeck;
import be.freenote.entity.User;
import be.freenote.exception.ForbiddenException;
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

    @InjectMocks private FlashcardDeckServiceImpl service;

    private User testUser(Long id) {
        return User.builder().id(id).username("user" + id).build();
    }

    private FlashcardDeck deckOwnedBy(Long ownerId) {
        return FlashcardDeck.builder().id(5L).owner(testUser(ownerId)).build();
    }

    @Test
    void shouldPublishDeckTrimmingAndCountingOnlyValidCards() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        when(deckRepository.save(any(FlashcardDeck.class))).thenAnswer(inv -> inv.getArgument(0));

        var request = new PublishDeckRequest("  Compta — TVA  ", "  ma desc  ", null,
                List.of(new FlashcardCardDto("  Q1  ", "  A1  "),
                        new FlashcardCardDto("Q2", null),            // null back → ""
                        new FlashcardCardDto("   ", "ignored")));     // blank front filtered out

        FlashcardDeckResponse res = service.publish(1L, request);

        assertThat(res.title()).isEqualTo("Compta — TVA");
        assertThat(res.description()).isEqualTo("ma desc");
        assertThat(res.cardCount()).isEqualTo(2);
        assertThat(res.cards()).containsExactly(
                new FlashcardCardDto("Q1", "A1"),
                new FlashcardCardDto("Q2", ""));
        assertThat(res.ownerName()).isEqualTo("user1");
        verify(courseRepository, never()).findById(any());  // no courseId → no course lookup
    }

    @Test
    void shouldRejectDeckWithNoValidCard() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        var request = new PublishDeckRequest("Empty", null, null,
                List.of(new FlashcardCardDto("   ", "x")));

        assertThatThrownBy(() -> service.publish(1L, request))
                .isInstanceOf(IllegalArgumentException.class);
        verify(deckRepository, never()).save(any());
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
