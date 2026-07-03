package be.freenote.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

/**
 * Stores revoked JWT IDs (jti) in Redis with TTL = remaining token lifetime.
 * A stolen JWT can thus be invalidated server-side before its natural expiration.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class JwtRevocationService {

    private static final String PREFIX = "jwt-revoked:";
    /** Per-user cutoff: any token ISSUED BEFORE the stored timestamp is rejected. Set on ban/account
     *  wipe so the wiped account's still-valid cookie dies immediately instead of living up to 24 h. */
    private static final String USER_PREFIX = "jwt-revoked-user:";

    private final StringRedisTemplate redisTemplate;

    @org.springframework.beans.factory.annotation.Value("${app.jwt.expiration-ms}")
    private long jwtExpirationMs;

    /** Invalidates EVERY token of this user issued up to now (ban / account wipe). TTL = max token
     *  lifetime: past that point, all pre-revocation tokens have expired naturally anyway. */
    public void revokeAllForUser(Long userId) {
        if (userId == null) return;
        try {
            redisTemplate.opsForValue().set(USER_PREFIX + userId,
                    String.valueOf(System.currentTimeMillis()), Duration.ofMillis(jwtExpirationMs));
        } catch (DataAccessException ex) {
            log.error("Redis unreachable during user-wide JWT revocation (userId={})", userId, ex);
        }
    }

    /** True when the user has a revocation cutoff and this token was issued before (or at) it. */
    public boolean isUserRevoked(Long userId, java.util.Date issuedAt) {
        if (userId == null || issuedAt == null) return false;
        try {
            String cutoff = redisTemplate.opsForValue().get(USER_PREFIX + userId);
            return cutoff != null && issuedAt.getTime() <= Long.parseLong(cutoff);
        } catch (DataAccessException ex) {
            // Fail-open, cohérent avec isRevoked (dispo > fenêtre résiduelle pendant une panne Redis).
            log.error("Redis unreachable during user revocation check (userId={})", userId, ex);
            return false;
        }
    }

    public boolean isRevoked(String jti) {
        if (jti == null || jti.isBlank()) return false;
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(PREFIX + jti));
        } catch (DataAccessException ex) {
            // Fail-open (availability > edge-case stolen-token window during Redis outage).
            // ERROR level ensures the outage is visible in monitoring/alerting.
            log.error("Redis unreachable during JWT revocation check — allowing token (jti={})", jti, ex);
            return false;
        }
    }

    public void revoke(String jti, Instant expiresAt) {
        if (jti == null || jti.isBlank() || expiresAt == null) return;
        Duration ttl = Duration.between(Instant.now(), expiresAt);
        if (ttl.isNegative() || ttl.isZero()) return;
        try {
            redisTemplate.opsForValue().set(PREFIX + jti, "1", ttl);
        } catch (DataAccessException ex) {
            // Revocation best-effort: if Redis is down, the token will still expire naturally via its exp claim.
            log.error("Redis unreachable during JWT revocation write (jti={})", jti, ex);
        }
    }
}
