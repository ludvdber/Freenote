package be.freenote.service;

import be.freenote.dto.request.KofiWebhookPayload;
import be.freenote.entity.Donation;
import be.freenote.entity.User;
import be.freenote.entity.UserProfile;
import be.freenote.repository.DonationRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.impl.KofiServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KofiServiceImplTest {

    @Mock private UserRepository userRepository;
    @Mock private DonationRepository donationRepository;

    @InjectMocks private KofiServiceImpl kofiService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(kofiService, "expectedToken", "valid-token");
        ReflectionTestUtils.setField(kofiService, "emailHashSalt", "salt");
    }

    private KofiWebhookPayload payload(String type, String token) {
        KofiWebhookPayload p = new KofiWebhookPayload();
        p.setVerificationToken(token);
        p.setType(type);
        p.setAmount("5.00");
        p.setFromName("Donor");
        p.setKofiTransactionId("tx-123");
        return p;
    }

    // ---- Token validation ----

    @Test
    void shouldIgnoreWhenInvalidVerificationToken() {
        KofiWebhookPayload p = payload("Donation", "wrong-token");

        kofiService.processWebhook(p);

        verify(donationRepository, never()).save(any());
    }

    @Test
    void shouldIgnoreWhenBlankExpectedToken() {
        ReflectionTestUtils.setField(kofiService, "expectedToken", "");
        KofiWebhookPayload p = payload("Donation", "any");

        kofiService.processWebhook(p);

        verify(donationRepository, never()).save(any());
    }

    // ---- Type filtering ----

    @Test
    void shouldIgnoreNonDonationType() {
        KofiWebhookPayload p = payload("Shop Order", "valid-token");

        kofiService.processWebhook(p);

        verify(donationRepository, never()).save(any());
    }

    @Test
    void shouldProcessSubscriptionType() {
        KofiWebhookPayload p = payload("Subscription", "valid-token");
        when(userRepository.findByUsername("Donor")).thenReturn(Optional.empty());

        kofiService.processWebhook(p);

        verify(donationRepository).save(any(Donation.class));
    }

    @Test
    void shouldProcessTipType() {
        // Ko-fi renamed the one-off donation type "Donation" → "Tip"; a tip must still grant ad-free.
        KofiWebhookPayload p = payload("Tip", "valid-token");
        when(userRepository.findByUsername("Donor")).thenReturn(Optional.empty());

        kofiService.processWebhook(p);

        verify(donationRepository).save(any(Donation.class));
    }

    // ---- User matching ----

    @Test
    void shouldMatchUserByEmailHash() {
        KofiWebhookPayload p = payload("Donation", "valid-token");
        p.setEmail("test@example.com");

        User user = User.builder().id(1L).username("test").build();
        UserProfile profile = UserProfile.builder().user(user).build();
        user.setProfile(profile);

        when(userRepository.findByEmailHash(anyString())).thenReturn(Optional.of(user));

        kofiService.processWebhook(p);

        assertThat(profile.getAdFreeUntil()).isAfter(LocalDateTime.now().plusDays(29));
        verify(donationRepository).save(any(Donation.class));
    }

    @Test
    void shouldMatchUserByUsernameWhenEmailNotMatched() {
        KofiWebhookPayload p = payload("Donation", "valid-token");
        p.setEmail("unknown@example.com");
        p.setFromName("JohnDoe");

        User user = User.builder().id(2L).username("JohnDoe").build();
        UserProfile profile = UserProfile.builder().user(user).build();
        user.setProfile(profile);

        when(userRepository.findByEmailHash(anyString())).thenReturn(Optional.empty());
        when(userRepository.findByUsername("JohnDoe")).thenReturn(Optional.of(user));

        kofiService.processWebhook(p);

        assertThat(profile.getAdFreeUntil()).isAfter(LocalDateTime.now().plusDays(29));
    }

    @Test
    void shouldCreateDonationEvenWhenUserNotMatched() {
        KofiWebhookPayload p = payload("Donation", "valid-token");
        p.setEmail(null);
        p.setFromName("Anonymous");

        when(userRepository.findByUsername("Anonymous")).thenReturn(Optional.empty());

        kofiService.processWebhook(p);

        ArgumentCaptor<Donation> captor = ArgumentCaptor.forClass(Donation.class);
        verify(donationRepository).save(captor.capture());
        assertThat(captor.getValue().getUser()).isNull();
        assertThat(captor.getValue().getKofiTransactionId()).isEqualTo("tx-123");
    }

    // ---- Ad-free cumulation ----

    @Test
    void shouldExtendAdFreeWhenAlreadyActive() {
        KofiWebhookPayload p = payload("Donation", "valid-token");
        p.setEmail("test@example.com");

        LocalDateTime existingExpiry = LocalDateTime.now().plusDays(10);

        User user = User.builder().id(1L).username("test").build();
        UserProfile profile = UserProfile.builder().user(user)
                .adFreeUntil(existingExpiry).build();
        user.setProfile(profile);

        when(userRepository.findByEmailHash(anyString())).thenReturn(Optional.of(user));

        kofiService.processWebhook(p);

        // Should extend from existing expiry + 30 days (not from now)
        assertThat(profile.getAdFreeUntil()).isAfter(existingExpiry.plusDays(29));
    }

    @Test
    void shouldResetAdFreeFromNowWhenExpired() {
        KofiWebhookPayload p = payload("Donation", "valid-token");
        p.setEmail("test@example.com");

        LocalDateTime pastExpiry = LocalDateTime.now().minusDays(5);

        User user = User.builder().id(1L).username("test").build();
        UserProfile profile = UserProfile.builder().user(user)
                .adFreeUntil(pastExpiry).build();
        user.setProfile(profile);

        when(userRepository.findByEmailHash(anyString())).thenReturn(Optional.of(user));

        kofiService.processWebhook(p);

        // Should start from now + 30 days since existing is expired
        assertThat(profile.getAdFreeUntil()).isAfter(LocalDateTime.now().plusDays(29));
        assertThat(profile.getAdFreeUntil()).isBefore(LocalDateTime.now().plusDays(31));
    }

    @Test
    void shouldIgnoreInvalidAmount() {
        KofiWebhookPayload p = payload("Donation", "valid-token");
        p.setAmount("not-a-number");

        kofiService.processWebhook(p);

        verify(donationRepository, never()).save(any());
    }
}
