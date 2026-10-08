package be.freenote.service;

import be.freenote.dto.response.AdminUserSupportResponse;
import be.freenote.dto.response.AdminUserSupportResponse.ActiveRateLimit;
import be.freenote.dto.response.AdminUserSupportResponse.PendingCode;
import be.freenote.entity.ActivityLog;
import be.freenote.entity.User;
import be.freenote.enums.ActivityType;
import be.freenote.repository.ActivityLogRepository;
import be.freenote.repository.Repositories;
import be.freenote.repository.UserOauthLinkRepository;
import be.freenote.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Fiche d'un compte côté admin et déblocages à la main. Les clés Redis lues ici sont celles
 * d'{@code AuthServiceImpl} (code de vérification) et de {@code RateLimitServiceImpl} (limites).
 */
@Service
@RequiredArgsConstructor
public class AdminUserSupportService {

    private static final String CODE_KEY = "verify:";
    private static final String ATTEMPTS_KEY = "verify-attempts:";
    private static final String REMINDER_KEY = "onboarding-reminder:";

    private final UserRepository userRepository;
    private final UserOauthLinkRepository oauthLinkRepository;
    private final ActivityLogRepository activityLogRepository;
    private final ActivityLogService activityLogService;
    private final StringRedisTemplate redisTemplate;

    @Transactional(readOnly = true)
    public AdminUserSupportResponse get(Long userId) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        LocalDateTime lastLogin = activityLogRepository
                .findFirstByActorIdAndTypeOrderByCreatedAtDesc(userId, ActivityType.LOGIN.name())
                .map(ActivityLog::getCreatedAt).orElse(null);
        ActivityLog email = activityLogRepository.findEmailEventsOf(List.of(userId)).stream().findFirst().orElse(null);
        boolean discord = oauthLinkRepository.findByUserId(userId).stream()
                .anyMatch(l -> "DISCORD".equalsIgnoreCase(l.getProvider()));
        boolean terms = user.getProfile() != null && user.getProfile().getTermsAcceptedAt() != null;

        return new AdminUserSupportResponse(user.getId(), user.getUsername(), user.isUsernameChosen(),
                user.isVerified(), terms, discord, user.getCreatedAt(), lastLogin, pendingCode(userId),
                email == null ? null : email.getType(), email == null ? null : email.getMessage(),
                email == null ? null : email.getCreatedAt(),
                Boolean.TRUE.equals(redisTemplate.hasKey(REMINDER_KEY + userId)), rateLimits(userId));
    }

    /** Annule le code en attente : l'étudiant devra en redemander un (utile après une faute dans l'adresse). */
    public void cancelCode(Long userId) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        redisTemplate.delete(List.of(CODE_KEY + userId, ATTEMPTS_KEY + userId));
        activityLogService.logStaff(ActivityType.STAFF_ACTION, "Code de vérification annulé : " + user.getUsername());
    }

    /** Remet les essais à zéro sans toucher au code : il reste valable jusqu'à son expiration. */
    public void resetAttempts(Long userId) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        redisTemplate.delete(ATTEMPTS_KEY + userId);
        activityLogService.logStaff(ActivityType.STAFF_ACTION, "Essais de code remis à zéro : " + user.getUsername());
    }

    /** Lève toutes les limites de débit du compte (ex. « 3 demandes de code par heure » atteinte). */
    public int clearRateLimits(Long userId) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        List<String> keys = new ArrayList<>(scan("rate:*:user:" + userId));
        keys.addAll(scan("rate-reported:*:user:" + userId));
        if (!keys.isEmpty()) redisTemplate.delete(keys);
        activityLogService.logStaff(ActivityType.STAFF_ACTION, "Limites de débit levées : " + user.getUsername());
        return keys.size();
    }

    private PendingCode pendingCode(Long userId) {
        Long ttl = redisTemplate.getExpire(CODE_KEY + userId);
        if (ttl == null || ttl <= 0) return null;
        return new PendingCode(ttl, parse(redisTemplate.opsForValue().get(ATTEMPTS_KEY + userId)));
    }

    private List<ActiveRateLimit> rateLimits(Long userId) {
        String suffix = ":user:" + userId;
        return scan("rate:*" + suffix).stream().map(key -> {
            String endpoint = key.substring("rate:".length(), key.length() - suffix.length()).replace("(..)", "");
            Long ttl = redisTemplate.getExpire(key);
            return new ActiveRateLimit(endpoint, parse(redisTemplate.opsForValue().get(key)), ttl == null ? 0 : Math.max(ttl, 0));
        }).toList();
    }

    private List<String> scan(String pattern) {
        List<String> keys = new ArrayList<>();
        try (Cursor<String> cursor = redisTemplate.scan(ScanOptions.scanOptions().match(pattern).count(500).build())) {
            cursor.forEachRemaining(keys::add);
        }
        return keys;
    }

    private static long parse(String value) {
        try {
            return value == null ? 0 : Long.parseLong(value);
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
