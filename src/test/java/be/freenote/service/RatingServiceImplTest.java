package be.freenote.service;

import be.freenote.entity.Document;
import be.freenote.entity.Rating;
import be.freenote.entity.User;
import be.freenote.enums.Category;
import be.freenote.event.XpEvent;
import be.freenote.exception.ForbiddenException;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.repository.DocumentRepository;
import be.freenote.repository.RatingRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.impl.RatingServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RatingServiceImplTest {

    @Mock private RatingRepository ratingRepository;
    @Mock private DocumentRepository documentRepository;
    @Mock private UserRepository userRepository;
    @Mock private ApplicationEventPublisher eventPublisher;

    @InjectMocks private RatingServiceImpl ratingService;

    private User testUser(Long id) {
        return User.builder().id(id).username("user" + id).build();
    }

    private Document testDocument(User author) {
        return Document.builder()
                .id(100L).title("Doc").category(Category.SYNTHESE).fileKey("k").fileSize(100L)
                .user(author).averageRating(BigDecimal.ZERO).ratingCount(0)
                .build();
    }

    // ---- New rating ----

    @Test
    void shouldCreateRatingAndUpdateDenormalizedCounters() {
        User voter = testUser(2L);
        User author = testUser(1L);
        Document doc = testDocument(author);

        when(userRepository.findById(2L)).thenReturn(Optional.of(voter));
        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));
        when(ratingRepository.findByDocumentIdAndUserId(100L, 2L)).thenReturn(Optional.empty());

        ratingService.rate(2L, 100L, 4);

        verify(ratingRepository).save(any(Rating.class));
        // Counters are recomputed atomically from the ratings table (no in-Java math).
        verify(documentRepository).recalcRatingStats(100L);
    }

    @Test
    void shouldAddXpToDocumentAuthorOnNewRating() {
        User voter = testUser(2L);
        User author = testUser(1L);
        Document doc = testDocument(author);

        when(userRepository.findById(2L)).thenReturn(Optional.of(voter));
        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));
        when(ratingRepository.findByDocumentIdAndUserId(100L, 2L)).thenReturn(Optional.empty());

        ratingService.rate(2L, 100L, 4);

        verify(eventPublisher).publishEvent(any(XpEvent.DocumentRated.class));
    }

    @Test
    void shouldNotAddXpWhenDocumentHasNoAuthor() {
        User voter = testUser(2L);
        Document doc = testDocument(null);

        when(userRepository.findById(2L)).thenReturn(Optional.of(voter));
        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));
        when(ratingRepository.findByDocumentIdAndUserId(100L, 2L)).thenReturn(Optional.empty());

        ratingService.rate(2L, 100L, 3);

        verify(eventPublisher, never()).publishEvent(any(XpEvent.class));
    }

    @Test
    void shouldRejectSelfRating() {
        User author = testUser(1L);
        Document doc = testDocument(author);

        when(userRepository.findById(1L)).thenReturn(Optional.of(author));
        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));

        assertThatThrownBy(() -> ratingService.rate(1L, 100L, 5))
                .isInstanceOf(ForbiddenException.class);

        // No rating persisted, no XP farmed, no average inflated.
        verify(ratingRepository, never()).save(any());
        verify(documentRepository, never()).recalcRatingStats(anyLong());
        verify(eventPublisher, never()).publishEvent(any());
    }

    // ---- Update existing rating ----

    @Test
    void shouldUpdateExistingRatingAndRecalculate() {
        User voter = testUser(2L);
        Document doc = testDocument(testUser(1L));
        doc.setAverageRating(new BigDecimal("3.00"));
        doc.setRatingCount(2);

        Rating existing = Rating.builder().id(10L).document(doc).user(voter).score(2).build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(voter));
        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));
        when(ratingRepository.findByDocumentIdAndUserId(100L, 2L)).thenReturn(Optional.of(existing));

        ratingService.rate(2L, 100L, 5);

        assertThat(existing.getScore()).isEqualTo(5);
        verify(ratingRepository).save(existing);
        verify(documentRepository).recalcRatingStats(100L);
    }

    @Test
    void shouldPublishDeltaEventOnUpdatedRating() {
        // Re-noter publie l'événement avec l'ancienne note : le listener ajuste l'XP par DELTA
        // (5★→2★ reprend la récompense) au lieu de l'empiler — anti-farming conservé.
        User voter = testUser(2L);
        Document doc = testDocument(testUser(1L));
        doc.setAverageRating(new BigDecimal("3.00"));
        doc.setRatingCount(1);

        Rating existing = Rating.builder().id(10L).document(doc).user(voter).score(3).build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(voter));
        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));
        when(ratingRepository.findByDocumentIdAndUserId(100L, 2L)).thenReturn(Optional.of(existing));

        ratingService.rate(2L, 100L, 5);

        var captor = org.mockito.ArgumentCaptor.forClass(Object.class);
        verify(eventPublisher).publishEvent(captor.capture());
        XpEvent.DocumentRated event = (XpEvent.DocumentRated) captor.getValue();
        assertThat(event.score()).isEqualTo(5);
        assertThat(event.previousScore()).isEqualTo(3);
    }

    @Test
    void shouldNotPublishEventWhenScoreUnchanged() {
        User voter = testUser(2L);
        Document doc = testDocument(testUser(1L));
        Rating existing = Rating.builder().id(10L).document(doc).user(voter).score(4).build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(voter));
        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));
        when(ratingRepository.findByDocumentIdAndUserId(100L, 2L)).thenReturn(Optional.of(existing));

        ratingService.rate(2L, 100L, 4);

        verify(eventPublisher, never()).publishEvent(any(XpEvent.class));
    }

    // ---- getAverageRating ----

    @Test
    void shouldReturnDenormalizedAverageRating() {
        Document doc = testDocument(null);
        doc.setAverageRating(new BigDecimal("4.25"));

        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));

        Double avg = ratingService.getAverageRating(100L);

        assertThat(avg).isEqualTo(4.25);
    }

    @Test
    void shouldThrowNotFoundWhenGettingRatingForMissingDoc() {
        when(documentRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> ratingService.getAverageRating(999L))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
