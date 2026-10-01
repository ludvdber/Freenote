package be.freenote.service.impl;

import be.freenote.repository.DailyStatRepository;
import be.freenote.service.TrackingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Buffer Redis : {@code stats:buffer:{yyyy-MM-dd}} est un hash {@code {metric}|{target} → count}
 * (HINCRBY, TTL 48 h — si le flush meurt 2 jours, on perd des stats anonymes, pas des données).
 * Le flush RENAME la clé (atomique — les incréments concurrents recréent le buffer) puis upsert
 * chaque entrée dans {@code daily_stats}. Même philosophie que le buffer download_count.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TrackingServiceImpl implements TrackingService {

    private static final String BUFFER_PREFIX = "stats:buffer:";
    private static final String PROFILE_DEDUP_PREFIX = "pv:";
    private static final Duration BUFFER_TTL = Duration.ofHours(48);
    private static final Duration PROFILE_DEDUP_TTL = Duration.ofHours(24);

    /** Sources de visite acceptées — le frontend classe par referrer + ?src= (campagnes). */
    private static final Set<String> VISIT_SOURCES = Set.of("direct", "organic", "social", "referral", "campaign");
    /** Slugs d'outils/guides : kebab-case strict (les slugs générés sont déjà accent-stripped). */
    private static final Pattern SLUG = Pattern.compile("^[a-z0-9][a-z0-9-]{0,99}$");
    private static final Pattern NUMERIC = Pattern.compile("^\\d{1,18}$");

    /** Requête de recherche normalisée : lettres, chiffres, espaces et tirets, 60 caractères max. */
    private static final int SEARCH_MISS_MAX_LENGTH = 60;
    private static final Pattern NON_ALNUM = Pattern.compile("[^a-z0-9 -]");
    private static final Pattern SPACES = Pattern.compile("\\s+");
    private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");

    private final StringRedisTemplate redisTemplate;
    private final DailyStatRepository dailyStatRepository;

    @Value("${app.analytics.retention-days:400}")
    private int retentionDays;

    @Override
    public void increment(String metric, String target) {
        try {
            String key = BUFFER_PREFIX + LocalDate.now();
            redisTemplate.opsForHash().increment(key, metric + "|" + target, 1);
            redisTemplate.expire(key, BUFFER_TTL);
        } catch (Exception e) {
            // Les stats ne doivent JAMAIS casser le chemin métier qui les émet (download, submit…).
            log.warn("Tracking increment failed for {}|{}: {}", metric, target, e.getMessage());
        }
    }

    @Override
    public void trackClientEvent(String metric, String target, String viewerKey) {
        if (metric == null || target == null) {
            return;
        }
        // Whitelist stricte — une entrée forgée est ignorée en silence (pas d'oracle pour un
        // attaquant, pas de pollution de la table par des cibles arbitraires).
        switch (metric) {
            case METRIC_VISIT, METRIC_VISIT_NEW -> {
                if (VISIT_SOURCES.contains(target)) {
                    increment(metric, target);
                }
            }
            case METRIC_CAMPAIGN -> {
                // Même whitelist que les slugs d'outils : une valeur de ?src= forgée ne crée pas
                // de ligne arbitraire dans la table.
                if (SLUG.matcher(target).matches()) {
                    increment(METRIC_CAMPAIGN, target);
                }
            }
            case METRIC_TOOL, METRIC_GUIDE -> {
                if (SLUG.matcher(target).matches()) {
                    increment(metric, target);
                }
            }
            case METRIC_PROFILE -> {
                if (!NUMERIC.matcher(target).matches()) {
                    return;
                }
                // Une vue de profil par (profil, viewer) par 24 h — sinon F5 gonfle le compteur.
                Boolean first = redisTemplate.opsForValue().setIfAbsent(
                        PROFILE_DEDUP_PREFIX + target + ":" + viewerKey, "1", PROFILE_DEDUP_TTL);
                if (Boolean.TRUE.equals(first)) {
                    increment(METRIC_PROFILE, target);
                }
            }
            default -> { /* métrique inconnue — ignorée */ }
        }
    }

    @Override
    public void trackSearchMiss(String query) {
        String normalized = normalizeQuery(query);
        if (normalized.isEmpty()) {
            return;
        }
        increment(METRIC_SEARCH_MISS, normalized);
    }

    /**
     * Minuscules, accents retirés, ponctuation écartée, espaces repliés, longueur bornée à la
     * colonne. Sans ça, « Compta Analytique », « compta analytique ! » et « comptabilité
     * analytique » occuperaient trois lignes du classement pour une seule demande.
     */
    static String normalizeQuery(String query) {
        if (query == null) {
            return "";
        }
        String folded = java.text.Normalizer.normalize(query.toLowerCase(java.util.Locale.ROOT),
                java.text.Normalizer.Form.NFD);
        String cleaned = SPACES.matcher(
                        NON_ALNUM.matcher(DIACRITICS.matcher(folded).replaceAll("")).replaceAll(" "))
                .replaceAll(" ")
                .trim();
        return cleaned.length() > SEARCH_MISS_MAX_LENGTH
                ? cleaned.substring(0, SEARCH_MISS_MAX_LENGTH).trim()
                : cleaned;
    }

    /** Flush périodique : la base est en retard d'au plus ~10 min sur le réel. */
    @Scheduled(fixedRate = 600_000, initialDelay = 90_000)
    @Transactional
    public void flush() {
        ScanOptions options = ScanOptions.scanOptions().match(BUFFER_PREFIX + "*").count(100).build();
        try (var cursor = redisTemplate.scan(options)) {
            while (cursor.hasNext()) {
                String key = cursor.next();
                LocalDate day;
                try {
                    day = LocalDate.parse(key.substring(BUFFER_PREFIX.length()));
                } catch (Exception e) {
                    continue; // clé inattendue — ne bloque pas les autres buffers
                }

                // RENAME atomique : les incréments concurrents recréent le buffer du jour,
                // rien n'est perdu entre la lecture et la suppression.
                String processingKey = "stats:flush:" + UUID.randomUUID();
                try {
                    redisTemplate.rename(key, processingKey);
                } catch (Exception e) {
                    continue; // clé disparue entre le scan et le rename (flush concurrent)
                }

                Map<Object, Object> entries = redisTemplate.opsForHash().entries(processingKey);
                for (Map.Entry<Object, Object> entry : entries.entrySet()) {
                    String field = entry.getKey().toString();
                    int sep = field.indexOf('|');
                    if (sep < 0) continue;
                    long count;
                    try {
                        count = Long.parseLong(entry.getValue().toString());
                    } catch (NumberFormatException e) {
                        continue;
                    }
                    dailyStatRepository.upsertAdd(day, field.substring(0, sep), field.substring(sep + 1), count);
                }
                redisTemplate.delete(processingKey);
            }
        }
    }

    /** Rétention bornée (~13 mois par défaut : comparaisons année sur année possibles). */
    @Scheduled(cron = "0 40 4 * * *")
    @Transactional
    public void prune() {
        int deleted = dailyStatRepository.deleteByDayBefore(LocalDate.now().minusDays(retentionDays));
        if (deleted > 0) {
            log.info("Pruned {} daily_stats rows older than {} days", deleted, retentionDays);
        }
    }
}
