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
import org.springframework.data.redis.core.SetOperations;
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
    @Mock private SetOperations<String, String> setOps;

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

    // --- Recherches sans résultat (2026-10-01) ---

    /**
     * La normalisation existe pour que la même demande ne se disperse pas en plusieurs lignes du
     * classement : c'est tout l'intérêt du panneau, qui sert à décider quoi produire.
     */
    @Test
    void normalizesSearchMissQueries() {
        trackingService.trackSearchMiss("  Comptabilité   ANALYTIQUE !! ");

        verify(hashOps).increment(todayKey(), "search_miss|comptabilite analytique", 1);
    }

    @Test
    void foldsAccentsAndCaseToASingleTarget() {
        trackingService.trackSearchMiss("Réseaux");
        trackingService.trackSearchMiss("reseaux");

        verify(hashOps, times(2)).increment(todayKey(), "search_miss|reseaux", 1);
    }

    /** La colonne est bornée : une requête absurde ne doit pas faire échouer l'INSERT du flush. */
    @Test
    void capsTheQueryLength() {
        trackingService.trackSearchMiss("a".repeat(200));

        verify(hashOps).increment(todayKey(), "search_miss|" + "a".repeat(60), 1);
    }

    @Test
    void ignoresAQueryWithNothingSearchable() {
        trackingService.trackSearchMiss("   ");
        trackingService.trackSearchMiss("???");
        trackingService.trackSearchMiss(null);

        verify(hashOps, never()).increment(anyString(), anyString(), anyLong());
    }

    // --- Nouvelles métriques client ---

    @Test
    void acceptsNewVisitorWithTheSameSourceWhitelist() {
        trackingService.trackClientEvent("visit_new", "social", "1");

        verify(hashOps).increment(todayKey(), "visit_new|social", 1);
    }

    @Test
    void rejectsAForgedVisitSource() {
        trackingService.trackClientEvent("visit_new", "<script>", "1");

        verify(hashOps, never()).increment(anyString(), anyString(), anyLong());
    }

    /** Le détail des campagnes doit rester une whitelist : sinon n'importe qui crée des lignes. */
    @Test
    void acceptsACampaignSlugAndRejectsAnythingElse() {
        trackingService.trackClientEvent("campaign", "qr-rentree-2026", "1");
        trackingService.trackClientEvent("campaign", "QR Rentrée", "1");

        verify(hashOps).increment(todayKey(), "campaign|qr-rentree-2026", 1);
        verify(hashOps, never()).increment(todayKey(), "campaign|QR Rentrée", 1);
    }

    /** Le collecteur est public et sans CSRF : au-delà du plafond, une NOUVELLE campagne est ignorée. */
    @Test
    void ignoresANewCampaignOnceTheDailyCapIsReached() {
        String key = "stats:targets:" + LocalDate.now() + ":campaign";
        when(redisTemplate.opsForSet()).thenReturn(setOps);
        when(setOps.add(key, "spam-51")).thenReturn(1L);
        when(setOps.size(key)).thenReturn(51L);

        trackingService.trackClientEvent("campaign", "spam-51", "1");

        verify(hashOps, never()).increment(eq(todayKey()), eq("campaign|spam-51"), anyLong());
        verify(setOps).remove(key, "spam-51");
    }

    /** Une campagne déjà vue aujourd'hui passe toujours, plafond atteint ou non. */
    @Test
    void stillCountsACampaignAlreadySeenToday() {
        when(redisTemplate.opsForSet()).thenReturn(setOps);
        when(setOps.add(anyString(), eq("qr-rentree-2026"))).thenReturn(0L);

        trackingService.trackClientEvent("campaign", "qr-rentree-2026", "1");

        verify(hashOps).increment(todayKey(), "campaign|qr-rentree-2026", 1);
        verify(setOps, never()).size(anyString());
    }
}
