package be.freenote.service;

import be.freenote.dto.response.NewsItem;
import be.freenote.service.impl.NewsServiceImpl;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SuppressWarnings("unchecked")
@ExtendWith(MockitoExtension.class)
class NewsServiceImplTest {

    @Mock private RedisTemplate<String, Object> redisTemplate;
    @Mock private ValueOperations<String, Object> valueOps;
    @Mock private ObjectMapper objectMapper;

    @InjectMocks private NewsServiceImpl newsService;

    @Test
    void getNews_shouldReturnCachedDataWhenAvailable() {
        List<NewsItem> cached = List.of(new NewsItem("id1", "t", "d", List.of(), "u", "<p>content</p>"));
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get("news:isfce")).thenReturn(cached);
        when(objectMapper.convertValue(eq(cached), any(TypeReference.class))).thenReturn(cached);

        List<NewsItem> result = newsService.getNews();

        assertThat(result).hasSize(1);
    }

    @Test
    void getNews_shouldFetchWhenCacheEmpty() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get("news:isfce")).thenReturn(null);

        // fetchFromFeed will attempt real HTTP — may succeed or fail depending on network
        // Either way, the method should not throw
        List<NewsItem> result = newsService.getNews();

        assertThat(result).isNotNull();
    }

    @Test
    void getNews_shouldFallbackWhenCacheDeserializationFails() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get("news:isfce")).thenReturn("corrupted");
        when(objectMapper.convertValue(eq("corrupted"), any(TypeReference.class)))
                .thenThrow(new IllegalArgumentException("bad data"));

        // Should not throw — falls through to fetchFromFeed
        List<NewsItem> result = newsService.getNews();

        assertThat(result).isNotNull();
    }
}
