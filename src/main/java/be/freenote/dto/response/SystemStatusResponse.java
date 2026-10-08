package be.freenote.dto.response;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Pane Système du panel admin : ce qui tourne, depuis quand, et si chaque service de données répond.
 *
 * @param indexedDocuments null = Meilisearch injoignable
 * @param diskFree         octets libres du système de fichiers de l'application
 */
public record SystemStatusResponse(
        String version,
        LocalDateTime startedAt,
        long uptimeSeconds,
        String javaVersion,
        long heapUsed,
        long heapMax,
        long diskFree,
        long diskTotal,
        List<Probe> services,
        long dbDocuments,
        Long indexedDocuments
) {
    /** @param name db, redis, minio ou meilisearch — libellé traduit côté client */
    public record Probe(String name, boolean up, long latencyMs) {}
}
