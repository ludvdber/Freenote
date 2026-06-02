package be.freenote.service;

import be.freenote.dto.response.SmtpStatusResponse;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

/**
 * Keeps the transactional SMTP key alive. Brevo (and similar providers) delete an SMTP key after
 * ~90 days of inactivity; Freenote sends almost no verification emails from January to August
 * (returning students are already registered), so the key would silently die before the September
 * sign-up rush — and the first new student of the year couldn't verify their address.
 *
 * <p>Every successful outbound email calls {@link #recordEmailSent()} (a Redis timestamp). A daily
 * job checks the inactivity counter and, once it reaches the threshold (default 80 days = a 10-day
 * safety margin before Brevo's 90), sends one maintenance email to {@code app.email.keepalive.to},
 * which resets the timer. The feature is disabled when that address is blank, so dev/local without
 * real SMTP never fire it. {@link #getStatus()} exposes the counter to admins (the "compteur").
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SmtpKeepAliveService {

    private static final String LAST_SENT_KEY = "email:last-sent";

    private final StringRedisTemplate redisTemplate;
    private final JavaMailSender mailSender;

    @Value("${app.email.from:noreply@freenote.be}")
    private String from;

    @Value("${app.email.keepalive.to:}")
    private String keepAliveTo;

    @Value("${app.email.keepalive.threshold-days:80}")
    private int thresholdDays;

    /** Resets the inactivity timer — call after every successful outbound email. */
    public void recordEmailSent() {
        redisTemplate.opsForValue().set(LAST_SENT_KEY, String.valueOf(Instant.now().toEpochMilli()));
    }

    private Long lastSentEpochMs() {
        String v = redisTemplate.opsForValue().get(LAST_SENT_KEY);
        return v == null ? null : Long.parseLong(v);
    }

    /** Days since the last email, or -1 when none has ever been recorded. */
    public long daysSinceLastSent() {
        Long last = lastSentEpochMs();
        if (last == null) return -1;
        return Duration.ofMillis(Instant.now().toEpochMilli() - last).toDays();
    }

    public boolean isEnabled() {
        return keepAliveTo != null && !keepAliveTo.isBlank();
    }

    public SmtpStatusResponse getStatus() {
        return new SmtpStatusResponse(lastSentEpochMs(), daysSinceLastSent(), isEnabled(), thresholdDays);
    }

    /**
     * Daily at 09:00 (overridable via {@code app.email.keepalive.cron}). Sends a keep-alive only
     * when the feature is enabled and inactivity has reached the threshold. A "never sent" state
     * (-1) also triggers, which is correct: it seeds the timer with one harmless email.
     */
    @Scheduled(cron = "${app.email.keepalive.cron:0 0 9 * * *}")
    public void keepAliveCheck() {
        if (!isEnabled()) return;
        long days = daysSinceLastSent();
        if (days >= 0 && days < thresholdDays) return;

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(from, "Freenote");
            helper.setTo(keepAliveTo);
            helper.setSubject("Freenote — maintenance SMTP");
            helper.setText("Email de maintenance automatique pour garder la clé SMTP active "
                    + "(aucune activité depuis " + (days < 0 ? "le démarrage" : days + " jour(s)")
                    + "). Aucune action requise.");
            mailSender.send(message);
            recordEmailSent();
            log.info("SMTP keep-alive sent to {} after {} day(s) of inactivity.", keepAliveTo, days);
        } catch (Exception e) {
            log.warn("SMTP keep-alive could not be sent: {}", e.getMessage());
        }
    }
}
