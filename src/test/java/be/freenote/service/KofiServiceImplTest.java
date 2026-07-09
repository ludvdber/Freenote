package be.freenote.service;

import be.freenote.dto.request.KofiWebhookPayload;
import be.freenote.entity.Donation;
import be.freenote.entity.User;
import be.freenote.repository.DonationRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.impl.KofiServiceImpl;
import be.freenote.util.KofiCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KofiServiceImplTest {

    @Mock private UserRepository userRepository;
    @Mock private DonationRepository donationRepository;
    @Mock private SupporterPerksService supporterPerksService;

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
    void shouldMatchUserByPersonalCodeInMessage() {
        KofiWebhookPayload p = payload("Tip", "valid-token");
        p.setEmail("perso@gmail.com"); // email perso ≠ email vérifié : seul le code matche
        p.setFromName("Pseudo Ko-fi quelconque");
        p.setMessage("Merci pour le site ! " + KofiCode.codeFor(42L, "salt"));

        User user = User.builder().id(42L).username("etudiant").build();
        when(userRepository.findById(42L)).thenReturn(Optional.of(user));
        when(supporterPerksService.applyPerks(eq(user), any())).thenReturn(LocalDateTime.now().plusDays(150));

        kofiService.processWebhook(p);

        // Le code court-circuite les autres matchings : ni email ni username interrogés.
        verify(userRepository, never()).findByEmailHash(anyString());
        verify(userRepository, never()).findByUsername(anyString());
        verify(supporterPerksService).applyPerks(eq(user), eq(new BigDecimal("5.00")));
    }

    @Test
    void shouldMatchUserByEmailHash() {
        KofiWebhookPayload p = payload("Donation", "valid-token");
        p.setEmail("test@example.com");

        User user = User.builder().id(1L).username("test").build();
        when(userRepository.findByEmailHash(anyString())).thenReturn(Optional.of(user));
        when(supporterPerksService.applyPerks(eq(user), any())).thenReturn(LocalDateTime.now().plusDays(150));

        kofiService.processWebhook(p);

        verify(supporterPerksService).applyPerks(eq(user), eq(new BigDecimal("5.00")));
        ArgumentCaptor<Donation> captor = ArgumentCaptor.forClass(Donation.class);
        verify(donationRepository).save(captor.capture());
        assertThat(captor.getValue().getAdFreeUntil()).isAfter(LocalDateTime.now().plusDays(149));
    }

    @Test
    void shouldMatchUserByUsernameWhenEmailNotMatched() {
        KofiWebhookPayload p = payload("Donation", "valid-token");
        p.setEmail("unknown@example.com");
        p.setFromName("JohnDoe");

        User user = User.builder().id(2L).username("JohnDoe").build();
        when(userRepository.findByEmailHash(anyString())).thenReturn(Optional.empty());
        when(userRepository.findByUsername("JohnDoe")).thenReturn(Optional.of(user));
        when(supporterPerksService.applyPerks(eq(user), any())).thenReturn(LocalDateTime.now().plusDays(150));

        kofiService.processWebhook(p);

        verify(supporterPerksService).applyPerks(eq(user), eq(new BigDecimal("5.00")));
    }

    @Test
    void shouldCreateDonationEvenWhenUserNotMatched() {
        KofiWebhookPayload p = payload("Donation", "valid-token");
        p.setEmail(null);
        p.setFromName("Anonymous");
        p.setMessage("super site");

        when(userRepository.findByUsername("Anonymous")).thenReturn(Optional.empty());

        kofiService.processWebhook(p);

        ArgumentCaptor<Donation> captor = ArgumentCaptor.forClass(Donation.class);
        verify(donationRepository).save(captor.capture());
        assertThat(captor.getValue().getUser()).isNull();
        assertThat(captor.getValue().getKofiTransactionId()).isEqualTo("tx-123");
        // Un don orphelin ne crédite personne — et garde le message pour le rattachement admin.
        assertThat(captor.getValue().getAdFreeUntil()).isNull();
        assertThat(captor.getValue().getMessage()).isEqualTo("super site");
        verify(supporterPerksService, never()).applyPerks(any(), any());
    }

    // ---- Idempotency & garde-fous ----

    @Test
    void shouldIgnoreAlreadyProcessedTransaction() {
        KofiWebhookPayload p = payload("Tip", "valid-token");
        when(donationRepository.existsByKofiTransactionId("tx-123")).thenReturn(true);

        kofiService.processWebhook(p);

        verify(donationRepository, never()).save(any());
        verify(supporterPerksService, never()).applyPerks(any(), any());
    }

    @Test
    void shouldIgnoreInvalidAmount() {
        KofiWebhookPayload p = payload("Donation", "valid-token");
        p.setAmount("not-a-number");

        kofiService.processWebhook(p);

        verify(donationRepository, never()).save(any());
    }

    // ---- Code personnel ----

    @Test
    void personalCodeRoundTripsThroughTheParser() {
        String code = kofiService.personalCode(7L);

        assertThat(code).startsWith("FN-");
        assertThat(KofiCode.findUserId("don pour freenote " + code, "salt")).contains(7L);
    }
}
