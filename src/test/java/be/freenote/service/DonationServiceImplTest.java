package be.freenote.service;

import be.freenote.dto.response.DonationResponse;
import be.freenote.dto.response.FundingResponse;
import be.freenote.entity.Donation;
import be.freenote.entity.User;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.repository.DonationRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.impl.DonationServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DonationServiceImplTest {

    @Mock private DonationRepository donationRepository;
    @Mock private UserRepository userRepository;
    @Mock private SupporterPerksService supporterPerksService;
    @Mock private SettingsService settingsService;

    @InjectMocks private DonationServiceImpl donationService;

    // ---- attach ----

    @Test
    void attachShouldLinkTheUserAndApplyPerks() {
        Donation donation = Donation.builder().id(10L).amount(new BigDecimal("5.00"))
                .kofiTransactionId("tx-1").build();
        User user = User.builder().id(3L).username("etudiant").build();
        LocalDateTime expiry = LocalDateTime.now().plusDays(150);

        when(donationRepository.findById(10L)).thenReturn(Optional.of(donation));
        when(userRepository.findById(3L)).thenReturn(Optional.of(user));
        when(supporterPerksService.applyPerks(user, new BigDecimal("5.00"))).thenReturn(expiry);

        DonationResponse resp = donationService.attach(10L, 3L);

        assertThat(donation.getUser()).isEqualTo(user);
        assertThat(donation.getAdFreeUntil()).isEqualTo(expiry);
        assertThat(resp.userId()).isEqualTo(3L);
        assertThat(resp.username()).isEqualTo("etudiant");
    }

    @Test
    void attachShouldRejectAnAlreadyMatchedDonation() {
        Donation donation = Donation.builder().id(10L).amount(BigDecimal.ONE)
                .user(User.builder().id(9L).build())
                .kofiTransactionId("tx-1").build();
        when(donationRepository.findById(10L)).thenReturn(Optional.of(donation));

        assertThatThrownBy(() -> donationService.attach(10L, 3L))
                .isInstanceOf(IllegalArgumentException.class);
        verify(supporterPerksService, never()).applyPerks(any(), any());
    }

    @Test
    void attachShouldFailOnUnknownDonation() {
        when(donationRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> donationService.attach(99L, 3L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ---- delete ----

    @Test
    void deleteShouldRemoveTheDonationRow() {
        Donation donation = Donation.builder().id(10L).amount(new BigDecimal("2.00"))
                .kofiTransactionId("tx-test").build();
        when(donationRepository.findById(10L)).thenReturn(Optional.of(donation));

        donationService.delete(10L);

        verify(donationRepository).delete(donation);
        // Purge d'audit uniquement — jamais de retrait d'avantages déjà appliqués.
        verifyNoInteractions(supporterPerksService);
    }

    @Test
    void deleteShouldFailOnUnknownDonation() {
        when(donationRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> donationService.delete(99L))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(donationRepository, never()).delete(any(Donation.class));
    }

    // ---- funding ----

    @Test
    void fundingIsDisabledWithoutAConfiguredCost() {
        when(settingsService.getFundingCost()).thenReturn(null);

        FundingResponse resp = donationService.getFunding();

        assertThat(resp.monthlyCost()).isNull();
        assertThat(resp.monthTotal()).isNull();
        assertThat(resp.donorCount()).isNull();
        // Jauge désactivée => pas de SUM inutile.
        verifyNoInteractions(donationRepository);
    }

    @Test
    void fundingSumsMatchedDonationsSinceTheFirstOfTheMonth() {
        when(settingsService.getFundingCost()).thenReturn(new BigDecimal("5"));
        when(donationRepository.sumMatchedAmountSince(any())).thenReturn(new BigDecimal("3.50"));
        when(donationRepository.countMatchedDonorsSince(any())).thenReturn(2L);

        FundingResponse resp = donationService.getFunding();

        assertThat(resp.monthlyCost()).isEqualByComparingTo("5");
        assertThat(resp.monthTotal()).isEqualByComparingTo("3.50");
        assertThat(resp.donorCount()).isEqualTo(2L);
        LocalDateTime monthStart = LocalDateTime.now().withDayOfMonth(1).toLocalDate().atStartOfDay();
        verify(donationRepository).sumMatchedAmountSince(monthStart);
        verify(donationRepository).countMatchedDonorsSince(monthStart);
    }
}
