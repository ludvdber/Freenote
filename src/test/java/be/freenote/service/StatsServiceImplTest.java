package be.freenote.service;

import be.freenote.dto.response.StatsResponse;
import be.freenote.repository.CourseRepository;
import be.freenote.repository.DocumentRepository;
import be.freenote.repository.SectionRepository;
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
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StatsServiceImplTest {

    // « :v2 » depuis l'ajout du champ sections — un cache prod à l'ancienne forme ne doit pas casser.
    private static final String CACHE_KEY = "stats:global:v2";

    @Mock private DocumentRepository documentRepository;
    @Mock private UserRepository userRepository;
    @Mock private CourseRepository courseRepository;
    @Mock private SectionRepository sectionRepository;
    @Mock private RedisTemplate<String, Object> redisTemplate;
    @Mock private ValueOperations<String, Object> valueOps;

    @InjectMocks private StatsServiceImpl statsService;

    private SectionRepository.SectionWithDocCount section(String name, Long count) {
        return new SectionRepository.SectionWithDocCount() {
            @Override public Long getId() { return 1L; }
            @Override public String getName() { return name; }
            @Override public String getIcon() { return null; }
            @Override public Boolean getApproved() { return true; }
            @Override public Long getDocumentCount() { return count; }
        };
    }

    @Test
    void shouldReturnCachedStatsWhenAvailable() {
        StatsResponse cached = new StatsResponse(100, 5000, 50, 20, 5, List.of());
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(CACHE_KEY)).thenReturn(cached);

        StatsResponse result = statsService.getStats();

        assertThat(result).isEqualTo(cached);
        verify(documentRepository, never()).count();
    }

    @Test
    void shouldComputeAndCacheStatsWhenNotCached() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(CACHE_KEY)).thenReturn(null);

        when(documentRepository.count()).thenReturn(100L);
        when(documentRepository.sumDownloadCount()).thenReturn(5000L);
        when(userRepository.count()).thenReturn(50L);
        when(courseRepository.count()).thenReturn(20L);
        when(documentRepository.countByCreatedAtAfter(any())).thenReturn(5L);
        when(sectionRepository.findAllApprovedWithDocCount())
                .thenReturn(List.of(section("Comptabilité", 3L), section("Informatique", 40L)));

        StatsResponse result = statsService.getStats();

        assertThat(result.totalDocs()).isEqualTo(100);
        assertThat(result.totalDownloads()).isEqualTo(5000);
        assertThat(result.totalContributors()).isEqualTo(50);
        assertThat(result.totalCourses()).isEqualTo(20);
        assertThat(result.weekUploads()).isEqualTo(5);
        // Sections triées par nombre de docs décroissant (la constellation dessine les plus actives en premier).
        assertThat(result.sections()).extracting(StatsResponse.SectionStat::name)
                .containsExactly("Informatique", "Comptabilité");
        // Boot 4.1 added a set(K,V,Consumer) overload, so the TTL arg must be typed to disambiguate.
        verify(valueOps).set(eq(CACHE_KEY), any(StatsResponse.class), any(Duration.class));
    }

    @Test
    void shouldNotReturnCacheWhenWrongType() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(CACHE_KEY)).thenReturn("not a StatsResponse");

        when(documentRepository.count()).thenReturn(0L);
        when(documentRepository.sumDownloadCount()).thenReturn(0L);
        when(userRepository.count()).thenReturn(0L);
        when(courseRepository.count()).thenReturn(0L);
        when(documentRepository.countByCreatedAtAfter(any())).thenReturn(0L);
        when(sectionRepository.findAllApprovedWithDocCount()).thenReturn(List.of());

        StatsResponse result = statsService.getStats();

        assertThat(result).isNotNull();
        verify(documentRepository).count();
    }
}
