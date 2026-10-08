package be.freenote.service;

import be.freenote.dto.response.SystemStatusResponse;
import be.freenote.dto.response.SystemStatusResponse.Probe;
import be.freenote.repository.DocumentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@SuppressWarnings("unchecked")
class AdminSystemServiceTest {

    @Mock private DocumentRepository documentRepository;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private MinioService minioService;
    @Mock private MeilisearchService meilisearchService;
    @Mock private ObjectProvider<BuildProperties> buildProperties;

    @InjectMocks private AdminSystemService service;

    @Test
    void toutRepond() {
        when(documentRepository.count()).thenReturn(120L);
        when(redisTemplate.execute(any(RedisCallback.class))).thenReturn("PONG");
        when(minioService.isReachable()).thenReturn(true);
        when(meilisearchService.indexedCount()).thenReturn(118L);

        SystemStatusResponse s = service.status();

        assertThat(s.services()).extracting(Probe::up).containsOnly(true);
        assertThat(s.dbDocuments()).isEqualTo(120);
        assertThat(s.indexedDocuments()).isEqualTo(118);
        assertThat(s.version()).isEqualTo("dev");
        assertThat(s.heapMax()).isPositive();
    }

    /** Une sonde qui lève affiche le service en rouge au lieu de faire tomber tout le pane. */
    @Test
    void unServiceEnPanneNeCassePasLePane() {
        when(documentRepository.count()).thenThrow(new IllegalStateException("db down"));
        when(redisTemplate.execute(any(RedisCallback.class))).thenThrow(new IllegalStateException("redis down"));
        when(minioService.isReachable()).thenReturn(false);
        when(meilisearchService.indexedCount()).thenReturn(null);

        SystemStatusResponse s = service.status();

        assertThat(s.services()).extracting(Probe::up).containsOnly(false);
        assertThat(s.dbDocuments()).isEqualTo(-1);
        assertThat(s.indexedDocuments()).isNull();
    }
}
