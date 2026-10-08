package be.freenote.service;

import be.freenote.dto.response.AdminUserSupportResponse;
import be.freenote.entity.ActivityLog;
import be.freenote.entity.User;
import be.freenote.entity.UserOauthLink;
import be.freenote.enums.ActivityType;
import be.freenote.repository.ActivityLogRepository;
import be.freenote.repository.UserOauthLinkRepository;
import be.freenote.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Iterator;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminUserSupportServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private UserOauthLinkRepository oauthLinkRepository;
    @Mock private ActivityLogRepository activityLogRepository;
    @Mock private ActivityLogService activityLogService;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;

    @InjectMocks private AdminUserSupportService service;

    private final User spike = User.builder().id(9L).username("Spike").usernameChosen(true).verified(false)
            .createdAt(LocalDateTime.now().minusDays(3)).build();

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(userRepository.findById(9L)).thenReturn(Optional.of(spike));
        UserOauthLink link = new UserOauthLink();
        link.setProvider("DISCORD");
        when(oauthLinkRepository.findByUserId(9L)).thenReturn(List.of(link));
        when(redisTemplate.scan(any(ScanOptions.class))).thenAnswer(inv -> cursor(List.of()));
    }

    @Test
    void ficheMontreCodeEnAttenteEtLimitesSansJamaisLeCode() {
        LocalDateTime login = LocalDateTime.now().minusHours(2);
        when(activityLogRepository.findFirstByActorIdAndTypeOrderByCreatedAtDesc(9L, "LOGIN"))
                .thenReturn(Optional.of(ActivityLog.builder().createdAt(login).build()));
        when(activityLogRepository.findEmailEventsOf(List.of(9L))).thenReturn(List.of(
                ActivityLog.builder().type("EMAIL_CODE_REJECTED").message("Code incorrect (essai 2/5)").build()));
        when(redisTemplate.getExpire("verify:9")).thenReturn(540L);
        when(valueOps.get("verify-attempts:9")).thenReturn("2");
        String key = "rate:AuthController.requestVerification(..):user:9";
        when(redisTemplate.scan(any(ScanOptions.class))).thenAnswer(inv -> cursor(List.of(key)));
        when(valueOps.get(key)).thenReturn("3");
        when(redisTemplate.getExpire(key)).thenReturn(1800L);

        AdminUserSupportResponse r = service.get(9L);

        assertThat(r.lastLoginAt()).isEqualTo(login);
        assertThat(r.discordLinked()).isTrue();
        assertThat(r.pendingCode()).isEqualTo(new AdminUserSupportResponse.PendingCode(540, 2));
        assertThat(r.lastEmailEvent()).isEqualTo("EMAIL_CODE_REJECTED");
        assertThat(r.rateLimits()).containsExactly(
                new AdminUserSupportResponse.ActiveRateLimit("AuthController.requestVerification", 3, 1800));
        verify(valueOps, never()).get("verify:9");
    }

    @Test
    void sansCodeNiConnexion() {
        when(redisTemplate.getExpire("verify:9")).thenReturn(-2L);

        AdminUserSupportResponse r = service.get(9L);

        assertThat(r.pendingCode()).isNull();
        assertThat(r.lastLoginAt()).isNull();
        assertThat(r.rateLimits()).isEmpty();
    }

    @Test
    @SuppressWarnings("unchecked")
    void annulerLeCodeEffaceAussiLesEssais() {
        service.cancelCode(9L);

        ArgumentCaptor<Collection<String>> keys = ArgumentCaptor.forClass(Collection.class);
        verify(redisTemplate).delete(keys.capture());
        assertThat(keys.getValue()).containsExactlyInAnyOrder("verify:9", "verify-attempts:9");
        verify(activityLogService).logStaff(eq(ActivityType.STAFF_ACTION), contains("Spike"));
    }

    @Test
    void remettreLesEssaisGardeLeCode() {
        service.resetAttempts(9L);

        verify(redisTemplate).delete("verify-attempts:9");
        verify(redisTemplate, never()).delete("verify:9");
    }

    @Test
    @SuppressWarnings("unchecked")
    void leverLesLimitesEffaceCompteursEtMarqueurs() {
        when(redisTemplate.scan(any(ScanOptions.class))).thenAnswer(inv -> {
            ScanOptions o = inv.getArgument(0);
            return cursor(o.getPattern().startsWith("rate-reported:")
                    ? List.of("rate-reported:A.b(..):user:9") : List.of("rate:A.b(..):user:9"));
        });

        assertThat(service.clearRateLimits(9L)).isEqualTo(2);

        ArgumentCaptor<Collection<String>> keys = ArgumentCaptor.forClass(Collection.class);
        verify(redisTemplate).delete(keys.capture());
        assertThat(keys.getValue()).containsExactlyInAnyOrder("rate:A.b(..):user:9", "rate-reported:A.b(..):user:9");
    }

    @SuppressWarnings("unchecked")
    private static Cursor<String> cursor(List<String> keys) {
        Cursor<String> c = mock(Cursor.class);
        Iterator<String> it = keys.iterator();
        org.mockito.Mockito.doAnswer(inv -> {
            java.util.function.Consumer<String> action = inv.getArgument(0);
            it.forEachRemaining(action);
            return null;
        }).when(c).forEachRemaining(any());
        return c;
    }
}
