package be.freenote.service;

import be.freenote.enums.ActivityType;
import be.freenote.repository.ActivityLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Remonte au panel admin les pannes qui n'allaient que dans journald (jeton Discord ou Ko-fi refusé,
 * SMTP qui refuse, indexation Meilisearch, erreur 500) : une ligne {@code SYSTEM_ALERT} par jour et
 * par panne, et un badge tant que personne ne les a acquittées. Le dédoublonnage est en mémoire
 * (une seule JVM) pour fonctionner même quand la panne est celle de Redis.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SystemAlertService {

    private static final String SEEN_KEY = "alerts:seen-at";
    /** Au-delà, une alerte non acquittée ne compte plus dans le badge (elle reste au journal). */
    private static final int BADGE_DAYS = 7;

    private final ActivityLogService activityLogService;
    private final ActivityLogRepository activityLogRepository;
    private final StringRedisTemplate redisTemplate;

    private final Map<String, LocalDate> lastRaised = new ConcurrentHashMap<>();

    /** Never throws. {@code kind} groups the alert for deduplication (« smtp », « discord »…). */
    public void raise(String kind, String message) {
        LocalDate today = LocalDate.now();
        if (today.equals(lastRaised.put(kind, today))) return;
        activityLogService.log(ActivityType.SYSTEM_ALERT, null, "Système", "[" + kind + "] " + message);
    }

    public long unacknowledgedCount() {
        LocalDateTime since = LocalDateTime.now().minusDays(BADGE_DAYS);
        try {
            String seen = redisTemplate.opsForValue().get(SEEN_KEY);
            if (seen != null) {
                LocalDateTime seenAt = LocalDateTime.ofInstant(Instant.ofEpochMilli(Long.parseLong(seen)), ZoneId.systemDefault());
                if (seenAt.isAfter(since)) since = seenAt;
            }
        } catch (Exception e) {
            log.debug("Alert acknowledgement unreadable: {}", e.getMessage());
        }
        return activityLogRepository.countByTypeAndCreatedAtGreaterThanEqual(ActivityType.SYSTEM_ALERT.name(), since);
    }

    /** Partagé entre admins : une alerte vue par l'un n'a pas à alerter l'autre. */
    public void acknowledge() {
        redisTemplate.opsForValue().set(SEEN_KEY, String.valueOf(System.currentTimeMillis()));
    }
}
