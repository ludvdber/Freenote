package be.freenote.service;

import be.freenote.dto.response.StatsResponse;
import be.freenote.repository.CourseRepository;
import be.freenote.repository.DocumentRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.impl.StatsServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StatsServiceImplTest {

    @Mock private DocumentRepository documentRepository;
    @Mock private UserRepository userRepository;
    @Mock private CourseRepository courseRepository;
    @Mock private RedisTemplate<String, Object> redisTemplate;
    @Mock private ValueOperations<String, Object> valueOps;

    @InjectMocks private StatsServiceImpl statsService;

    @Test
    void shouldReturnCachedStatsWhenAvailable() {
        StatsResponse cached = new StatsResponse(100, 5000, 50, 20, 5);
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get("stats:global")).thenReturn(cached);

        StatsResponse result = statsService.getStats();

        assertThat(result).isEqualTo(cached);
        verify(documentRepository, never()).count();
    }

    @Test
    void shouldComputeAndCacheStatsWhenNotCached() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get("stats:global")).thenReturn(null);

        when(documentRepository.count()).thenReturn(100L);
        when(documentRepository.sumDownloadCount()).thenReturn(5000L);
        when(userRepository.count()).thenReturn(50L);
        when(courseRepository.count()).thenReturn(20L);
        when(documentRepository.countByCreatedAtAfter(any())).thenReturn(5L);

        StatsResponse result = statsService.getStats();

        assertThat(result.totalDocs()).isEqualTo(100);
        assertThat(result.totalDownloads()).isEqualTo(5000);
        assertThat(result.totalContributors()).isEqualTo(50);
        assertThat(result.totalCourses()).isEqualTo(20);
        assertThat(result.weekUploads()).isEqualTo(5);
        // Boot 4.1 added a set(K,V,Consumer) overload, so the TTL arg must be typed to disambiguate.
        verify(valueOps).set(eq("stats:global"), any(StatsResponse.class), any(Duration.class));
    }

    @Test
    void shouldNotReturnCacheWhenWrongType() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get("stats:global")).thenReturn("not a StatsResponse");

        when(documentRepository.count()).thenReturn(0L);
        when(documentRepository.sumDownloadCount()).thenReturn(0L);
        when(userRepository.count()).thenReturn(0L);
        when(courseRepository.count()).thenReturn(0L);
        when(documentRepository.countByCreatedAtAfter(any())).thenReturn(0L);

        StatsResponse result = statsService.getStats();

        assertThat(result).isNotNull();
        verify(documentRepository).count();
    }
}
