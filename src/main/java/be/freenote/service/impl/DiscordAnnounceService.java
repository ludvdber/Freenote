package be.freenote.service.impl;

import be.freenote.entity.Document;
import be.freenote.event.XpEvent;
import be.freenote.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * Posts an hourly digest of newly <strong>verified</strong> documents to a Discord channel via the
 * bot token — ONE batched message, and only when there is something new (no spam, no idle posts).
 *
 * <p>Doc IDs are buffered in Redis on {@link XpEvent.DocumentVerified}; a {@code @Scheduled} job
 * drains the buffer hourly and posts a single embed linking back to the site (to drive traffic).
 * Disabled (no-op) when the bot token or the announce channel ID is unset.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DiscordAnnounceService {

    private static final String QUEUE_KEY = "discord-announce-queue";
    private static final String API_BASE = "https://discord.com/api/v10";
    private static final int MAX_LISTED = 10;

    private final StringRedisTemplate redisTemplate;
    private final DocumentRepository documentRepository;
    private final ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Value("${app.discord.bot-token:}")
    private String botToken;
    @Value("${app.discord.announce-channel-id:}")
    private String channelId;
    @Value("${app.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    private boolean enabled() {
        return !botToken.isBlank() && !channelId.isBlank();
    }

    /** Buffer a freshly verified document for the next hourly digest. */
    @EventListener
    public void onDocumentVerified(XpEvent.DocumentVerified event) {
        if (enabled() && event.documentId() != null) {
            redisTemplate.opsForList().rightPush(QUEUE_KEY, String.valueOf(event.documentId()));
        }
    }

    /** Hourly: post ONE digest of the buffered docs, or nothing if the buffer is empty. */
    @Scheduled(fixedRate = 3_600_000)
    @Transactional(readOnly = true)
    public void flush() {
        if (!enabled()) {
            return;
        }
        // Drain the queue atomically (left-pop until empty), de-duplicating while preserving order.
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        String raw;
        while ((raw = redisTemplate.opsForList().leftPop(QUEUE_KEY)) != null) {
            try {
                ids.add(Long.parseLong(raw));
            } catch (NumberFormatException ignored) {
                // skip malformed entry
            }
        }
        if (ids.isEmpty()) {
            return;
        }

        List<Document> docs = documentRepository.findAllById(ids);
        if (docs.isEmpty()) {
            return;
        }

        StringBuilder description = new StringBuilder();
        int shown = 0;
        for (Document d : docs) {
            if (shown >= MAX_LISTED) {
                break;
            }
            String line = "• [" + escapeMd(d.getTitle()) + "](" + frontendUrl + "/documents/" + d.getId() + ")";
            if (d.getCourse() != null && d.getCourse().getName() != null) {
                line += " · " + escapeMd(d.getCourse().getName());
            }
            description.append(line).append('\n');
            shown++;
        }
        int extra = docs.size() - shown;
        if (extra > 0) {
            description.append("… et ").append(extra).append(" autre").append(extra > 1 ? "s" : "");
        }

        Map<String, Object> embed = Map.of(
                "title", "📚 Nouveaux documents sur Freenote",
                "description", description.toString().trim(),
                "url", frontendUrl + "/browse",
                "color", 0x6C5CE7
        );
        post(Map.of("embeds", List.of(embed)));
    }

    private void post(Map<String, Object> payload) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(API_BASE + "/channels/" + channelId + "/messages"))
                    .timeout(Duration.ofSeconds(10))
                    .header("Authorization", "Bot " + botToken)
                    .header("Content-Type", "application/json")
                    .header("User-Agent", "Freenote (https://freenote.be, 1.0)")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            if (status / 100 == 2) {
                log.info("Discord: posted new-documents digest to channel {}", channelId);
            } else if (status == 403) {
                log.warn("Discord: forbidden (403) posting to channel {} — the bot needs View Channel + Send Messages there", channelId);
            } else if (status == 401) {
                log.error("Discord: unauthorized (401) posting digest — invalid bot token");
            } else {
                log.warn("Discord: unexpected status {} posting digest — {}", status, response.body());
            }
        } catch (Exception e) {
            log.warn("Discord digest post failed: {}", e.getMessage());
        }
    }

    /** Embeds use Markdown — neutralise brackets in link text so titles don't break the link. */
    private static String escapeMd(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("[", "(").replace("]", ")");
    }
}
