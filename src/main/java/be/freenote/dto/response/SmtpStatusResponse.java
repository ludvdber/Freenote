package be.freenote.dto.response;

/**
 * SMTP keep-alive health, surfaced to admins via {@code GET /api/admin/smtp-status}.
 *
 * @param lastSentEpochMs   epoch millis of the last outbound email, or null if none recorded yet
 * @param daysSinceLastSent days since the last email (-1 if none ever recorded)
 * @param keepAliveEnabled  whether the automatic keep-alive is configured (address set)
 * @param thresholdDays     inactivity threshold (days) that triggers a keep-alive email
 */
public record SmtpStatusResponse(
        Long lastSentEpochMs,
        long daysSinceLastSent,
        boolean keepAliveEnabled,
        int thresholdDays
) {}
