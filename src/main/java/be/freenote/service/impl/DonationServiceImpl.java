package be.freenote.service.impl;

import be.freenote.dto.response.DonationResponse;
import be.freenote.dto.response.FundingResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.entity.Donation;
import be.freenote.entity.User;
import be.freenote.entity.UserProfile;
import be.freenote.repository.DonationRepository;
import be.freenote.repository.UserRepository;
import be.freenote.repository.Repositories;
import be.freenote.service.DonationService;
import be.freenote.service.SettingsService;
import be.freenote.service.SupporterPerksService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DonationServiceImpl implements DonationService {

    private final DonationRepository donationRepository;
    private final UserRepository userRepository;
    private final SupporterPerksService supporterPerksService;
    private final SettingsService settingsService;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<DonationResponse> listAll(Pageable pageable) {
        Page<Donation> page = donationRepository.findAllByOrderByIdDesc(pageable);
        List<DonationResponse> content = page.getContent().stream().map(this::toResponse).toList();
        return PageResponse.from(page, content);
    }

    @Override
    @Transactional
    public DonationResponse grantAdFree(Long targetUserId, int days, Long actingAdminId) {
        if (days <= 0 || days > 3650) {
            throw new IllegalArgumentException("days must be between 1 and 3650");
        }
        User user = Repositories.findByIdOrThrow(userRepository, targetUserId, "User");
        UserProfile profile = user.getProfile();
        if (profile == null) {
            profile = UserProfile.builder().user(user).build();
            user.setProfile(profile);
        }

        // Extend existing period if still active, otherwise start fresh from now.
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime base = profile.getAdFreeUntil() != null && profile.getAdFreeUntil().isAfter(now)
                ? profile.getAdFreeUntil()
                : now;
        LocalDateTime newExpiry = base.plusDays(days);
        profile.setAdFreeUntil(newExpiry);

        Donation audit = Donation.builder()
                .user(user)
                .amount(BigDecimal.ZERO)
                .kofiTransactionId("MANUAL-" + actingAdminId + "-" + System.currentTimeMillis())
                .adFreeUntil(newExpiry)
                .build();
        donationRepository.save(audit);

        log.info("Admin {} granted {} ad-free days to user {} (until {})", actingAdminId, days, user.getUsername(), newExpiry);
        return toResponse(audit);
    }

    @Override
    @Transactional
    public DonationResponse attach(Long donationId, Long userId) {
        Donation donation = Repositories.findByIdOrThrow(donationRepository, donationId, "Donation");
        if (donation.getUser() != null) {
            throw new IllegalArgumentException("Ce don est déjà rattaché à un compte");
        }
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        donation.setUser(user);
        // Applique les avantages a posteriori (mêmes règles que le webhook) — c'est tout l'intérêt
        // du rattachement : repêcher un donateur qui a oublié son code « FN-… ».
        donation.setAdFreeUntil(supporterPerksService.applyPerks(user, donation.getAmount()));
        log.info("Donation {} attached to user {} ({}€)", donationId, user.getUsername(), donation.getAmount());
        return toResponse(donation);
    }

    @Override
    @Transactional
    public void delete(Long donationId) {
        Donation donation = Repositories.findByIdOrThrow(donationRepository, donationId, "Donation");
        donationRepository.delete(donation);
        log.info("Donation {} deleted ({}€, tx {}, user {})", donationId, donation.getAmount(),
                donation.getKofiTransactionId(),
                donation.getUser() != null ? donation.getUser().getUsername() : "unmatched");
    }

    @Override
    @Transactional(readOnly = true)
    public FundingResponse getFunding() {
        BigDecimal cost = settingsService.getFundingCost();
        if (cost == null) {
            return new FundingResponse(null, null, null);
        }
        LocalDateTime monthStart = LocalDateTime.now().withDayOfMonth(1).toLocalDate().atStartOfDay();
        return new FundingResponse(cost,
                donationRepository.sumMatchedAmountSince(monthStart),
                donationRepository.countMatchedDonorsSince(monthStart));
    }

    private DonationResponse toResponse(Donation d) {
        User u = d.getUser();
        return new DonationResponse(
                d.getId(),
                u != null ? u.getId() : null,
                u != null ? u.getUsername() : null,
                d.getAmount(),
                d.getKofiTransactionId(),
                d.getAdFreeUntil(),
                d.getMessage(),
                d.getCreatedAt()
        );
    }
}
