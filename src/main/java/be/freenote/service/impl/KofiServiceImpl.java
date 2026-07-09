package be.freenote.service.impl;

import be.freenote.dto.request.KofiWebhookPayload;
import be.freenote.entity.Donation;
import be.freenote.entity.User;
import be.freenote.repository.DonationRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.KofiService;
import be.freenote.service.SupporterPerksService;
import be.freenote.util.HashUtil;
import be.freenote.util.KofiCode;
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
    private final SupporterPerksService supporterPerksService;

    @Value("${app.kofi.verification-token:}")
    private String expectedToken;

    @Value("${app.email.hash-salt}")
    private String emailHashSalt;

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

        // Null-guard séparé : new BigDecimal(null) lève un NPE (pas un NumberFormatException),
        // qui serait avalé silencieusement par le catch générique du controller.
        if (payload.getAmount() == null) {
            log.warn("Ko-fi webhook: missing amount (type={})", type);
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

        // Matching, du plus fiable au moins fiable :
        // 1. le code personnel « FN-… » collé dans le message (seul canal garanti — personne ne met
        //    son email d'école sur Ko-fi) ; 2. l'email du don == email vérifié du compte ;
        // 3. le nom Ko-fi == pseudo Freenote.
        Optional<User> userOpt = KofiCode.findUserId(payload.getMessage(), emailHashSalt)
                .flatMap(userRepository::findById);

        if (userOpt.isEmpty() && payload.getEmail() != null && !payload.getEmail().isBlank()) {
            String hash = HashUtil.hashEmail(payload.getEmail(), emailHashSalt);
            userOpt = userRepository.findByEmailHash(hash);
        }

        if (userOpt.isEmpty() && payload.getFromName() != null) {
            userOpt = userRepository.findByUsername(payload.getFromName());
        }

        User user = userOpt.orElse(null);

        // Avantages (règles centralisées dans SupporterPerksService). Un don non rattaché ne crédite
        // personne — la ligne reste en attente, l'admin peut la rattacher a posteriori.
        LocalDateTime adFreeUntil = null;
        if (user != null) {
            adFreeUntil = supporterPerksService.applyPerks(user, amount);
            log.info("Ko-fi donation processed: user={}, amount={}, ad-free until {}",
                    user.getUsername(), amount, adFreeUntil);
        } else {
            log.info("Ko-fi donation processed: unmatched donor '{}', amount={}, transaction={}",
                    payload.getFromName(), amount, payload.getKofiTransactionId());
        }

        String message = payload.getMessage();
        donationRepository.save(Donation.builder()
                .user(user)
                .amount(amount)
                .kofiTransactionId(payload.getKofiTransactionId())
                .adFreeUntil(adFreeUntil)
                .message(message != null && message.length() > 500 ? message.substring(0, 500) : message)
                .build());
    }

    @Override
    public String personalCode(Long userId) {
        return KofiCode.codeFor(userId, emailHashSalt);
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
