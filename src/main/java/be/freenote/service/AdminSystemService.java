package be.freenote.service;

import be.freenote.dto.response.SystemStatusResponse;
import be.freenote.dto.response.SystemStatusResponse.Probe;
import be.freenote.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.io.File;
import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;

/**
 * Pane Système : sonde chacun des quatre services de données (une requête légère chacun) et
 * rapporte l'état de la JVM. Une sonde ne lève jamais : un service en panne s'affiche rouge.
 */
@Service
@RequiredArgsConstructor
public class AdminSystemService {

    private final DocumentRepository documentRepository;
    private final StringRedisTemplate redisTemplate;
    private final MinioService minioService;
    private final MeilisearchService meilisearchService;
    private final ObjectProvider<BuildProperties> buildProperties;

    public SystemStatusResponse status() {
        AtomicLong dbDocs = new AtomicLong(-1);
        Probe db = probe("db", () -> {
            dbDocs.set(documentRepository.count());
            return true;
        });
        Probe redis = probe("redis", () -> "PONG".equalsIgnoreCase(
                redisTemplate.execute((RedisCallback<String>) c -> c.ping())));
        Probe minio = probe("minio", minioService::isReachable);
        AtomicReference<Long> indexed = new AtomicReference<>();
        Probe meili = probe("meilisearch", () -> {
            indexed.set(meilisearchService.indexedCount());
            return indexed.get() != null;
        });

        var runtime = ManagementFactory.getRuntimeMXBean();
        var heap = ManagementFactory.getMemoryMXBean().getHeapMemoryUsage();
        File disk = new File(".");
        BuildProperties build = buildProperties.getIfAvailable();

        return new SystemStatusResponse(
                build == null ? "dev" : build.getVersion(),
                LocalDateTime.ofInstant(Instant.ofEpochMilli(runtime.getStartTime()), ZoneId.systemDefault()),
                runtime.getUptime() / 1000,
                Runtime.version().toString(),
                heap.getUsed(),
                heap.getMax(),
                disk.getUsableSpace(),
                disk.getTotalSpace(),
                List.of(db, redis, minio, meili),
                dbDocs.get(),
                indexed.get());
    }

    public void resyncSearchIndex() {
        meilisearchService.resyncIfNeeded();
    }

    private static Probe probe(String name, BooleanSupplier check) {
        long start = System.nanoTime();
        boolean up;
        try {
            up = check.getAsBoolean();
        } catch (Exception e) {
            up = false;
        }
        return new Probe(name, up, (System.nanoTime() - start) / 1_000_000);
    }
}
