package be.freenote.service.impl;

import be.freenote.config.MeilisearchConfig;
import be.freenote.entity.Document;
import be.freenote.repository.DocumentRepository;
import be.freenote.service.MeilisearchService;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class MeilisearchServiceImpl implements MeilisearchService {

    private static final String INDEX = "documents";

    private final MeilisearchConfig meilisearchConfig;
    private final ObjectMapper objectMapper;
    private final DocumentRepository documentRepository;
    private static final int MAX_RETRIES = 3;
    private static final long[] RETRY_DELAYS_MS = {1000, 3000, 10000};

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @EventListener(ApplicationReadyEvent.class)
    public void initIndex() {
        try {
            // Create index if it doesn't exist
            ObjectNode createBody = objectMapper.createObjectNode();
            createBody.put("uid", INDEX);
            createBody.put("primaryKey", "id");

            HttpRequest createReq = HttpRequest.newBuilder()
                    .uri(URI.create(meilisearchConfig.getHost() + "/indexes"))
                    .header("Authorization", "Bearer " + meilisearchConfig.getApiKey())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(createBody.toString()))
                    .build();
            httpClient.send(createReq, HttpResponse.BodyHandlers.ofString());

            // Configure filterable attributes
            ArrayNode filterableAttrs = objectMapper.createArrayNode();
            filterableAttrs.add("sectionId");
            filterableAttrs.add("courseId");
            filterableAttrs.add("category");
            filterableAttrs.add("language");
            filterableAttrs.add("verified");
            filterableAttrs.add("year");

            HttpRequest filterReq = HttpRequest.newBuilder()
                    .uri(URI.create(meilisearchConfig.getHost() + "/indexes/" + INDEX + "/settings/filterable-attributes"))
                    .header("Authorization", "Bearer " + meilisearchConfig.getApiKey())
                    .header("Content-Type", "application/json")
                    .PUT(HttpRequest.BodyPublishers.ofString(filterableAttrs.toString()))
                    .build();
            httpClient.send(filterReq, HttpResponse.BodyHandlers.ofString());

            // Configure searchable attributes (priority order)
            ArrayNode searchableAttrs = objectMapper.createArrayNode();
            searchableAttrs.add("title");
            searchableAttrs.add("courseName");
            searchableAttrs.add("sectionName");
            searchableAttrs.add("professorName");

            HttpRequest searchReq = HttpRequest.newBuilder()
                    .uri(URI.create(meilisearchConfig.getHost() + "/indexes/" + INDEX + "/settings/searchable-attributes"))
                    .header("Authorization", "Bearer " + meilisearchConfig.getApiKey())
                    .header("Content-Type", "application/json")
                    .PUT(HttpRequest.BodyPublishers.ofString(searchableAttrs.toString()))
                    .build();
            httpClient.send(searchReq, HttpResponse.BodyHandlers.ofString());

            // Configure sortable attributes
            ArrayNode sortableAttrs = objectMapper.createArrayNode();
            sortableAttrs.add("verifiedRank");
            sortableAttrs.add("createdAt");
            sortableAttrs.add("downloadCount");
            sortableAttrs.add("averageRating");

            HttpRequest sortReq = HttpRequest.newBuilder()
                    .uri(URI.create(meilisearchConfig.getHost() + "/indexes/" + INDEX + "/settings/sortable-attributes"))
                    .header("Authorization", "Bearer " + meilisearchConfig.getApiKey())
                    .header("Content-Type", "application/json")
                    .PUT(HttpRequest.BodyPublishers.ofString(sortableAttrs.toString()))
                    .build();
            httpClient.send(sortReq, HttpResponse.BodyHandlers.ofString());

            log.info("Meilisearch index '{}' configured: filterable, searchable, sortable attributes set", INDEX);

            // Reindex if count mismatch
            reindexIfNeeded();

        } catch (Exception e) {
            // NB : il n'y a PAS de fallback DB pour la recherche avec `q` (par design) — index KO
            // signifie recherche vide jusqu'au prochain initIndex/dailyResync réussi.
            log.warn("Meilisearch index init failed (search with a query will return empty until re-init): {}", e.getMessage());
        }
    }

    /**
     * Daily safety net. {@link #initIndex()} already runs at boot, but a long-running process
     * can drift if a document was indexed between an outage of Meilisearch and its restart.
     * Cheap when the counts match (one HTTP GET + one COUNT(*) query).
     */
    @Scheduled(cron = "0 0 4 * * *")
    public void dailyResync() {
        try {
            reindexIfNeeded();
        } catch (Exception e) {
            log.warn("Meilisearch daily re-sync skipped: {}", e.getMessage());
        }
    }

    private void reindexIfNeeded() {
        try {
            HttpRequest statsReq = HttpRequest.newBuilder()
                    .uri(URI.create(meilisearchConfig.getHost() + "/indexes/" + INDEX + "/stats"))
                    .header("Authorization", "Bearer " + meilisearchConfig.getApiKey())
                    .GET()
                    .build();

            HttpResponse<String> statsResp = httpClient.send(statsReq, HttpResponse.BodyHandlers.ofString());
            JsonNode statsNode = objectMapper.readTree(statsResp.body());
            long meiliCount = statsNode.path("numberOfDocuments").asLong(0);
            long dbCount = documentRepository.count();

            if (meiliCount == dbCount && dbCount > 0) {
                log.info("Meilisearch index in sync ({} documents), skipping reindex", dbCount);
                return;
            }

            log.info("Meilisearch reindex needed: Meilisearch={}, DB={}. Reindexing...", meiliCount, dbCount);

            List<Document> allDocs = documentRepository.findAllWithAssociations();
            for (Document doc : allDocs) {
                indexDocument(doc);
            }

            log.info("Meilisearch reindex complete: {} documents indexed", allDocs.size());

        } catch (Exception e) {
            log.warn("Meilisearch reindex check failed: {}", e.getMessage());
        }
    }

    @Override
    public void indexDocument(Document document) {
        try {
            ObjectNode doc = objectMapper.createObjectNode();
            doc.put("id", document.getId());
            doc.put("title", document.getTitle());
            doc.put("category", document.getCategory().name());
            doc.put("courseId", document.getCourse().getId());
            doc.put("courseName", document.getCourse().getName());
            doc.put("sectionId", document.getCourse().getSection().getId());
            doc.put("sectionName", document.getCourse().getSection().getName());
            doc.put("language", document.getLanguage());
            doc.put("year", document.getYear());
            if (document.getProfessor() != null) {
                doc.put("professorName", document.getProfessor().getName());
            }
            doc.put("verified", document.isVerified());
            // Numeric mirror of `verified` so Meilisearch can sort verified-first (booleans aren't sortable).
            doc.put("verifiedRank", document.isVerified() ? 1 : 0);
            doc.put("downloadCount", document.getDownloadCount());
            if (document.getAverageRating() != null) {
                doc.put("averageRating", document.getAverageRating().doubleValue());
            }
            if (document.getCreatedAt() != null) {
                doc.put("createdAt", document.getCreatedAt().toString());
            }

            ArrayNode docs = objectMapper.createArrayNode();
            docs.add(doc);

            String body = docs.toString();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(meilisearchConfig.getHost() + "/indexes/" + INDEX + "/documents"))
                    .header("Authorization", "Bearer " + meilisearchConfig.getApiKey())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            sendWithRetry(request, "index document " + document.getId(), 0);

        } catch (Exception e) {
            log.error("Failed to index document {} in Meilisearch: {}", document.getId(), e.getMessage());
        }
    }

    private void sendWithRetry(HttpRequest request, String operation, int attempt) {
        httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenAccept(response -> {
                    if (response.statusCode() >= 200 && response.statusCode() < 300) {
                        log.debug("Meilisearch {} succeeded", operation);
                    } else if (attempt < MAX_RETRIES) {
                        log.warn("Meilisearch {} returned {}, retrying ({}/{})",
                                operation, response.statusCode(), attempt + 1, MAX_RETRIES);
                        retryAfterDelay(request, operation, attempt + 1);
                    } else {
                        log.error("Meilisearch {} failed after {} retries: HTTP {}",
                                operation, MAX_RETRIES, response.statusCode());
                    }
                })
                .exceptionally(ex -> {
                    if (attempt < MAX_RETRIES) {
                        log.warn("Meilisearch {} failed ({}), retrying ({}/{})",
                                operation, ex.getMessage(), attempt + 1, MAX_RETRIES);
                        retryAfterDelay(request, operation, attempt + 1);
                    } else {
                        log.error("Meilisearch {} failed after {} retries: {}",
                                operation, MAX_RETRIES, ex.getMessage());
                    }
                    return null;
                });
    }

    private void retryAfterDelay(HttpRequest request, String operation, int attempt) {
        CompletableFuture.delayedExecutor(RETRY_DELAYS_MS[attempt - 1], TimeUnit.MILLISECONDS)
                .execute(() -> sendWithRetry(request, operation, attempt));
    }

    @Override
    public SearchResult search(String query, Long sectionId, java.util.Collection<Long> courseIds,
                               String category, String sort, Pageable pageable) {
        try {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("q", query);
            body.put("limit", pageable.getPageSize());
            body.put("offset", (int) pageable.getOffset());

            List<String> filters = new ArrayList<>();
            if (sectionId != null) {
                filters.add("sectionId = " + sectionId);
            }
            if (courseIds != null && !courseIds.isEmpty()) {
                // OR explicite (pas l'opérateur IN) : supporté par toutes les versions de Meilisearch
                filters.add(courseIds.stream()
                        .map(id -> "courseId = " + id)
                        .collect(java.util.stream.Collectors.joining(" OR ", "(", ")")));
            }
            if (category != null) {
                filters.add("category = " + category);
            }
            if (!filters.isEmpty()) {
                body.put("filter", String.join(" AND ", filters));
            }
            // Verified documents always rank above unverified ones; the caller's sort (if any)
            // applies within each group. Verification is a visual aid, so unverified docs stay visible.
            ArrayNode sortArray = body.putArray("sort");
            sortArray.add("verifiedRank:desc");
            if (sort != null) {
                sortArray.add(sort);
            }

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(meilisearchConfig.getHost() + "/indexes/" + INDEX + "/search"))
                    .header("Authorization", "Bearer " + meilisearchConfig.getApiKey())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode root = objectMapper.readTree(response.body());
            JsonNode hits = root.get("hits");

            List<Long> ids = new ArrayList<>();
            if (hits != null && hits.isArray()) {
                for (JsonNode hit : hits) {
                    ids.add(hit.get("id").asLong());
                }
            }
            // Meilisearch returns estimatedTotalHits by default; totalHits appears only with
            // exhaustive pagination. Prefer the exact count when present.
            long total = root.has("totalHits")
                    ? root.path("totalHits").asLong(0)
                    : root.path("estimatedTotalHits").asLong(0);
            return new SearchResult(ids, total);

        } catch (Exception e) {
            log.error("Meilisearch search failed: {}", e.getMessage());
            return new SearchResult(List.of(), 0);
        }
    }

    @Override
    public void deleteDocument(Long documentId) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(meilisearchConfig.getHost() + "/indexes/" + INDEX + "/documents/" + documentId))
                    .header("Authorization", "Bearer " + meilisearchConfig.getApiKey())
                    .DELETE()
                    .build();

            sendWithRetry(request, "delete document " + documentId, 0);

        } catch (Exception e) {
            log.error("Failed to delete document {} from Meilisearch: {}", documentId, e.getMessage());
        }
    }
}
