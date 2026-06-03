package be.freenote.service;

import be.freenote.dto.response.DocumentResponse;
import be.freenote.entity.Document;
import be.freenote.mapper.DocumentMapper;
import be.freenote.repository.DocumentRepository;
import be.freenote.service.impl.RecentDocsServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.RedisTemplate;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RecentDocsServiceImplTest {

    @Mock private RedisTemplate<String, Object> redisTemplate;
    @Mock private ListOperations<String, Object> listOps;
    @Mock private DocumentRepository documentRepository;
    @Mock private DocumentMapper documentMapper;

    @InjectMocks private RecentDocsServiceImpl service;

    private static final String KEY = "user:42:recent-docs";

    @BeforeEach
    void setupListOps() {
        when(redisTemplate.opsForList()).thenReturn(listOps);
    }

    @Test
    void recordVisit_shouldDedupeAndBumpToFront() {
        service.recordVisit(42L, 7L);

        verify(listOps).remove(eq(KEY), eq(0L), eq("7"));
        verify(listOps).leftPush(eq(KEY), eq("7"));
        verify(listOps).trim(eq(KEY), eq(0L), eq(19L));
        verify(redisTemplate).expire(eq(KEY), any(Duration.class));
    }

    @Test
    void recordVisit_shouldBeNoopWhenUserIdNull() {
        // Mockito strict mode would flag the opsForList() stubbing as unused, so skip it entirely here.
        // (The @BeforeEach still registers it, but no Redis method should be hit.)
        RecentDocsServiceImpl svc = new RecentDocsServiceImpl(redisTemplate, documentRepository, documentMapper);
        svc.recordVisit(null, 1L);
        verify(listOps, never()).leftPush(any(), any());
    }

    @Test
    void getRecent_shouldReturnEmptyWhenRedisEmpty() {
        when(listOps.range(eq(KEY), eq(0L), anyLong())).thenReturn(List.of());

        List<DocumentResponse> result = service.getRecent(42L, 5);

        assertThat(result).isEmpty();
    }

    @Test
    void getRecent_shouldPreserveOrderAndKeepUnverified() {
        // Verification is a visual aid, not access control — unverified docs the user opened still show.
        when(listOps.range(eq(KEY), eq(0L), eq(4L))).thenReturn(List.of("10", "11", "12"));
        Document verified10 = Document.builder().id(10L).verified(true).build();
        Document unverified11 = Document.builder().id(11L).verified(false).build();
        Document verified12 = Document.builder().id(12L).verified(true).build();
        when(documentRepository.findAllById(List.of(10L, 11L, 12L)))
                .thenReturn(List.of(verified10, unverified11, verified12));

        DocumentResponse resp10 = stubDoc(10L);
        DocumentResponse resp11 = stubDoc(11L);
        DocumentResponse resp12 = stubDoc(12L);
        when(documentMapper.toResponse(verified10)).thenReturn(resp10);
        when(documentMapper.toResponse(unverified11)).thenReturn(resp11);
        when(documentMapper.toResponse(verified12)).thenReturn(resp12);

        List<DocumentResponse> result = service.getRecent(42L, 5);

        assertThat(result).containsExactly(resp10, resp11, resp12);
    }

    @Test
    void getRecent_shouldSkipNonNumericRedisEntries() {
        when(listOps.range(eq(KEY), eq(0L), eq(4L))).thenReturn(List.of("abc", "10"));
        Document verified10 = Document.builder().id(10L).verified(true).build();
        when(documentRepository.findAllById(List.of(10L))).thenReturn(List.of(verified10));
        DocumentResponse resp10 = stubDoc(10L);
        when(documentMapper.toResponse(verified10)).thenReturn(resp10);

        List<DocumentResponse> result = service.getRecent(42L, 5);

        assertThat(result).containsExactly(resp10);
    }

    private static DocumentResponse stubDoc(Long id) {
        return new DocumentResponse(
                id, "title", 1L, "course", "section", "NOTES",
                "author", null, true, false, "FR", null, null,
                0.0, 0, null);
    }
}
