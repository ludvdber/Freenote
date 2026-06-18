package be.freenote.service.impl;

import be.freenote.dto.request.KofiWebhookPayload;
import be.freenote.entity.Donation;
import be.freenote.entity.User;
import be.freenote.entity.UserProfile;
import be.freenote.repository.DonationRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.KofiService;
import be.freenote.util.HashUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class KofiServiceImpl implements KofiService {

    private final UserRepository userRepository;
    private final DonationRepository donationRepository;

    @Value("${app.kofi.verification-token:}")
    private String expectedToken;

    @Value("${app.email.hash-salt}")
    private String emailHashSalt;

    private static final int AD_FREE_DAYS_PER_DONATION = 30;

    @Override
    @Transactional
    public void processWebhook(KofiWebhookPayload payload) {
        if (expectedToken.isBlank() || !constantTimeEquals(expectedToken, payload.getVerificationToken())) {
            log.warn("Ko-fi webhook rejected: invalid verification token");
            return;
        }

        // Ko-fi renamed the one-off donation type "Donation" → "Tip" (current dashboard / webhook
        // docs). Accept both so a single tip still grants ad-free, plus recurring "Subscription".
        // Commission / Shop Order aren't supporter donations for Freenote, so they stay ignored.
        String type = payload.getType();
        if (!"Tip".equals(type) && !"Donation".equals(type) && !"Subscription".equals(type)) {
            log.info("Ko-fi webhook ignored: type={}", type);
            return;
        }

        BigDecimal amount;
        try {
            amount = new BigDecimal(payload.getAmount());
        } catch (NumberFormatException e) {
            log.warn("Ko-fi webhook: invalid amount '{}'", payload.getAmount());
            return;
        }

        // Idempotency: Ko-fi retries on any non-200, and network glitches can replay a webhook.
        // Processing the same transaction twice would double the donation row and the ad-free grant.
        String txId = payload.getKofiTransactionId();
        if (txId != null && donationRepository.existsByKofiTransactionId(txId)) {
            log.info("Ko-fi webhook ignored: transaction {} already processed", txId);
            return;
        }

        // Try to match user by email hash
        Optional<User> userOpt = Optional.empty();
        if (payload.getEmail() != null && !payload.getEmail().isBlank()) {
            String hash = HashUtil.hashEmail(payload.getEmail(), emailHashSalt);
            userOpt = userRepository.findByEmailHash(hash);
        }

        // If no match by email, try by Ko-fi display name == username
        if (userOpt.isEmpty() && payload.getFromName() != null) {
            userOpt = userRepository.findByUsername(payload.getFromName());
        }

        User user = userOpt.orElse(null);
        LocalDateTime now = LocalDateTime.now();

        // Compute the (cumulative) ad-free expiry first so the donation audit row records the real
        // expiry the donor ends up with, not a flat now+30 that understates cumulative gifts.
        LocalDateTime adFreeUntil;
        if (user != null && user.getProfile() != null) {
            UserProfile profile = user.getProfile();
            LocalDateTime base = profile.getAdFreeUntil() != null && profile.getAdFreeUntil().isAfter(now)
                    ? profile.getAdFreeUntil()
                    : now;
            adFreeUntil = base.plusDays(AD_FREE_DAYS_PER_DONATION);
            profile.setAdFreeUntil(adFreeUntil);
            log.info("Ko-fi donation processed: user={}, amount={}, ad-free until {}",
                    user.getUsername(), amount, adFreeUntil);
        } else {
            adFreeUntil = now.plusDays(AD_FREE_DAYS_PER_DONATION);
            log.info("Ko-fi donation processed: unmatched donor '{}', amount={}, transaction={}",
                    payload.getFromName(), amount, payload.getKofiTransactionId());
        }

        donationRepository.save(Donation.builder()
                .user(user)
                .amount(amount)
                .kofiTransactionId(payload.getKofiTransactionId())
                .adFreeUntil(adFreeUntil)
                .build());
    }

    /** Constant-time comparison so a forged-webhook attacker can't recover the token byte-by-byte
     *  via response timing. Null/empty candidate is rejected (length mismatch ⇒ false). */
    private static boolean constantTimeEquals(String expected, String candidate) {
        if (candidate == null) return false;
        return java.security.MessageDigest.isEqual(
                expected.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                candidate.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
