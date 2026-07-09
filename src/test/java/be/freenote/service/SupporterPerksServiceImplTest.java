package be.freenote.service;

import be.freenote.entity.User;
import be.freenote.entity.UserOauthLink;
import be.freenote.entity.UserProfile;
import be.freenote.repository.UserOauthLinkRepository;
import be.freenote.service.impl.SupporterPerksServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SupporterPerksServiceImplTest {

    @Mock private UserOauthLinkRepository oauthLinkRepository;
    @Mock private DiscordRoleService discordRoleService;

    @InjectMocks private SupporterPerksServiceImpl perksService;

    private static User userWithProfile() {
        User user = User.builder().id(1L).username("test").build();
        UserProfile profile = UserProfile.builder().user(user).build();
        user.setProfile(profile);
        return user;
    }

    // ---- Palier < 5 € ----

    @Test
    void smallDonationGrantsOneMonthAdFreeAndOneMonthPalettes() {
        User user = userWithProfile();

        LocalDateTime expiry = perksService.applyPerks(user, new BigDecimal("2.00"));

        UserProfile p = user.getProfile();
        assertThat(expiry).isAfter(LocalDateTime.now().plusDays(29)).isBefore(LocalDateTime.now().plusDays(31));
        assertThat(p.getAdFreeUntil()).isEqualTo(expiry);
        assertThat(p.getPalettesUntil()).isAfter(LocalDateTime.now().plusDays(29));
        assertThat(p.isLifetimeSupporter()).isFalse();
        verifyNoInteractions(discordRoleService);
    }

    @Test
    void smallDonationsCumulateBothEntitlements() {
        User user = userWithProfile();
        LocalDateTime existing = LocalDateTime.now().plusDays(10);
        user.getProfile().setAdFreeUntil(existing);
        user.getProfile().setPalettesUntil(existing);

        perksService.applyPerks(user, new BigDecimal("1.00"));

        assertThat(user.getProfile().getAdFreeUntil()).isAfter(existing.plusDays(29));
        assertThat(user.getProfile().getPalettesUntil()).isAfter(existing.plusDays(29));
    }

    // ---- Palier ≥ 5 € ----

    @Test
    void bigDonationGrantsOneMonthPerEuroAndLifetimePalettes() {
        User user = userWithProfile();
        when(oauthLinkRepository.findByUserId(1L)).thenReturn(List.of(
                UserOauthLink.builder().provider("DISCORD").oauthId("snowflake-1").build()));

        LocalDateTime expiry = perksService.applyPerks(user, new BigDecimal("5.50"));

        // 5,50 € => 5 mois (partie entière), pas de palettes_until (illimité via le flag).
        assertThat(expiry).isAfter(LocalDateTime.now().plusDays(149)).isBefore(LocalDateTime.now().plusDays(151));
        assertThat(user.getProfile().isLifetimeSupporter()).isTrue();
        assertThat(user.getProfile().getPalettesUntil()).isNull();
        verify(discordRoleService).assignSupporterRole("snowflake-1");
    }

    @Test
    void bigDonationWithoutDiscordLinkSkipsTheRolePush() {
        User user = userWithProfile();
        when(oauthLinkRepository.findByUserId(1L)).thenReturn(List.of());

        perksService.applyPerks(user, new BigDecimal("10.00"));

        assertThat(user.getProfile().isLifetimeSupporter()).isTrue();
        verifyNoInteractions(discordRoleService);
    }

    @Test
    void adFreeIsCappedAtThirtySixMonths() {
        User user = userWithProfile();
        when(oauthLinkRepository.findByUserId(1L)).thenReturn(List.of());

        LocalDateTime expiry = perksService.applyPerks(user, new BigDecimal("100.00"));

        // 100 € ne donne PAS 100 mois : plafond 36 mois (durée d'un bachelier).
        assertThat(expiry).isBefore(LocalDateTime.now().plusDays(36L * 30 + 1));
        assertThat(expiry).isAfter(LocalDateTime.now().plusDays(36L * 30 - 1));
    }

    @Test
    void capAppliesOnTopOfAnExistingAdFreePeriod() {
        User user = userWithProfile();
        user.getProfile().setAdFreeUntil(LocalDateTime.now().plusDays(35L * 30));
        when(oauthLinkRepository.findByUserId(1L)).thenReturn(List.of());

        LocalDateTime expiry = perksService.applyPerks(user, new BigDecimal("12.00"));

        assertThat(expiry).isBefore(LocalDateTime.now().plusDays(36L * 30 + 1));
    }

    @Test
    void createsTheProfileWhenMissing() {
        User user = User.builder().id(1L).username("test").build();
        user.setProfile(null);

        perksService.applyPerks(user, new BigDecimal("2.00"));

        assertThat(user.getProfile()).isNotNull();
        assertThat(user.getProfile().getAdFreeUntil()).isAfter(LocalDateTime.now().plusDays(29));
    }
}
