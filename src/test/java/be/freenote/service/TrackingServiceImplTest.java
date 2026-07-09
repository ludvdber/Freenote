package be.freenote.service;

import be.freenote.repository.DailyStatRepository;
import be.freenote.service.impl.TrackingServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.time.LocalDate;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TrackingServiceImplTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private DailyStatRepository dailyStatRepository;
    @Mock private HashOperations<String, Object, Object> hashOps;
    @Mock private ValueOperations<String, String> valueOps;

    @InjectMocks private TrackingServiceImpl trackingService;

    private String todayKey() {
        return "stats:buffer:" + LocalDate.now();
    }

    @BeforeEach
    void stubHash() {
        lenient().when(redisTemplate.opsForHash()).thenReturn(hashOps);
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
    }

    @Test
    void incrementBumpsTheDailyHashAndRefreshesTtl() {
        trackingService.increment("doc_view", "");

        verify(hashOps).increment(todayKey(), "doc_view|", 1);
        verify(redisTemplate).expire(eq(todayKey()), any(Duration.class));
    }

    @Test
    void incrementNeverThrows() {
        // Une panne Redis ne doit pas casser le chemin métier (download, submit…).
        when(redisTemplate.opsForHash()).thenThrow(new RuntimeException("redis down"));

        trackingService.increment("doc_view", "");
    }

    @Test
    void visitAcceptsOnlyWhitelistedSources() {
        trackingService.trackClientEvent("visit", "organic", "ip1");
        verify(hashOps).increment(todayKey(), "visit|organic", 1);

        trackingService.trackClientEvent("visit", "hax", "ip1");
        verifyNoMoreInteractions(hashOps);
    }

    @Test
    void toolAndGuideRequireAKebabCaseSlug() {
        trackingService.trackClientEvent("tool", "quiz", "ip1");
        verify(hashOps).increment(todayKey(), "tool|quiz", 1);

        trackingService.trackClientEvent("guide", "jointures-sql", "ip1");
        verify(hashOps).increment(todayKey(), "guide|jointures-sql", 1);

        trackingService.trackClientEvent("tool", "DROP TABLE", "ip1");
        trackingService.trackClientEvent("guide", "<script>", "ip1");
        verifyNoMoreInteractions(hashOps);
    }

    @Test
    void profileViewIsDedupedPerViewerPerDay() {
        when(valueOps.setIfAbsent(eq("pv:42:u7"), eq("1"), any(Duration.class))).thenReturn(true);
        trackingService.trackClientEvent("profile", "42", "u7");
        verify(hashOps).increment(todayKey(), "profile|42", 1);

        when(valueOps.setIfAbsent(eq("pv:42:u7"), eq("1"), any(Duration.class))).thenReturn(false);
        trackingService.trackClientEvent("profile", "42", "u7");
        verifyNoMoreInteractions(hashOps);
    }

    @Test
    void profileTargetMustBeNumeric() {
        trackingService.trackClientEvent("profile", "abc", "u7");

        verifyNoInteractions(valueOps, hashOps);
    }

    @Test
    void unknownMetricAndNullsAreIgnored() {
        trackingService.trackClientEvent("evil", "x", "ip1");
        trackingService.trackClientEvent(null, "x", "ip1");
        trackingService.trackClientEvent("visit", null, "ip1");

        verifyNoInteractions(hashOps);
    }
}
