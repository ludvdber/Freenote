package be.freenote.service;

import be.freenote.dto.response.AdminAttentionResponse;
import be.freenote.entity.ActivityLog;
import be.freenote.entity.User;
import be.freenote.entity.UserOauthLink;
import be.freenote.enums.ActivityType;
import be.freenote.exception.DuplicateResourceException;
import be.freenote.repository.ActivityLogRepository;
import be.freenote.repository.UserOauthLinkRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.DiscordRoleService.DmResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminAttentionServiceTest {

    @Mock private SmtpKeepAliveService smtpKeepAliveService;
    @Mock private SystemAlertService systemAlertService;
    @Mock private UserRepository userRepository;
    @Mock private UserOauthLinkRepository oauthLinkRepository;
    @Mock private ActivityLogRepository activityLogRepository;
    @Mock private ActivityLogService activityLogService;
    @Mock private DiscordRoleService discordRoleService;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;

    @InjectMocks private AdminAttentionService service;

    private final User spike = User.builder().id(9L).username("Spike").usernameChosen(true).verified(false).build();

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(userRepository.findById(9L)).thenReturn(Optional.of(spike));
        UserOauthLink link = new UserOauthLink();
        link.setProvider("DISCORD");
        link.setOauthId("123");
        when(oauthLinkRepository.findByUserId(9L)).thenReturn(List.of(link));
    }

    @Test
    void relanceEnvoyeeEtTracee() {
        when(valueOps.setIfAbsent(eq("onboarding-reminder:9"), eq("1"), any(Duration.class))).thenReturn(true);
        when(discordRoleService.sendDirectMessage(eq("123"), contains("vérifier ton adresse"))).thenReturn(DmResult.SENT);

        assertThat(service.remindOnboarding(9L)).isEqualTo(DmResult.SENT);
        verify(activityLogService).logStaff(eq(ActivityType.STAFF_ACTION), contains("Spike"));
    }

    /** Un double clic ne doit pas envoyer deux MP. */
    @Test
    void uneSeuleRelanceParJour() {
        when(valueOps.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(false);

        assertThatThrownBy(() -> service.remindOnboarding(9L)).isInstanceOf(DuplicateResourceException.class);
        verify(discordRoleService, never()).sendDirectMessage(any(), any());
    }

    /** MP fermés : rien n'est parti, l'admin doit pouvoir réessayer plus tard. */
    @Test
    void echecLibereLeCreneau() {
        when(valueOps.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true);
        when(discordRoleService.sendDirectMessage(any(), any())).thenReturn(DmResult.UNREACHABLE);

        assertThat(service.remindOnboarding(9L)).isEqualTo(DmResult.UNREACHABLE);
        verify(redisTemplate).delete("onboarding-reminder:9");
        verify(activityLogService, never()).logStaff(any(), any());
    }

    @Test
    void refuseUnCompteDejaVerifie() {
        spike.setVerified(true);
        assertThatThrownBy(() -> service.remindOnboarding(9L)).isInstanceOf(IllegalArgumentException.class);
    }

    /** Chaque compte bloqué porte son DERNIER événement e-mail : c'est ce qui dit où il a calé. */
    @Test
    void compteBloqueAvecSonDernierEvenementEmail() {
        spike.setCreatedAt(LocalDateTime.now().minusDays(3));
        when(userRepository.findTop30ByVerifiedFalseAndCreatedAtBetweenOrderByCreatedAtDesc(any(), any()))
                .thenReturn(List.of(spike));
        LocalDateTime now = LocalDateTime.now();
        when(activityLogRepository.findEmailEventsOf(List.of(9L))).thenReturn(List.of(
                ActivityLog.builder().actorId(9L).type("EMAIL_CODE_SENT").message("récent").createdAt(now).build(),
                ActivityLog.builder().actorId(9L).type("EMAIL_CODE_BLOCKED").message("ancien").createdAt(now.minusDays(1)).build()));

        AdminAttentionResponse r = service.getAttention();

        assertThat(r.stuckAccounts()).singleElement().satisfies(a -> {
            assertThat(a.username()).isEqualTo("Spike");
            assertThat(a.lastEmailEvent()).isEqualTo("EMAIL_CODE_SENT");
        });
    }
}
