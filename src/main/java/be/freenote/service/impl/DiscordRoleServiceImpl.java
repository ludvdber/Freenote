package be.freenote.service.impl;

import be.freenote.service.DiscordRoleService;
import be.freenote.service.SystemAlertService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/**
 * Calls {@code PUT /guilds/{guild}/members/{user}/roles/{role}} on the Discord REST API with the
 * bot token. The same Discord *application* powers OAuth login and this bot (different credential:
 * the Bot Token, not the OAuth Client Secret).
 *
 * <p>Blank config (token/guild/role) ⇒ disabled, so dev/local/test run without a Discord call.
 * Les deux rôles (« vérifié », « Supporter ») partagent le même mécanisme — chacun est activable
 * indépendamment par son role-id.
 */
@Slf4j
@Service
public class DiscordRoleServiceImpl implements DiscordRoleService {

    private static final String API_BASE = "https://discord.com/api/v10";

    private final String botToken;
    private final String guildId;
    private final String verifiedRoleId;
    private final String supporterRoleId;

    private static final ObjectMapper JSON = JsonMapper.builder().build();

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /** Optionnel (setter) : les tests construisent ce service à la main. */
    private SystemAlertService systemAlertService;

    @Autowired(required = false)
    void setSystemAlertService(SystemAlertService systemAlertService) {
        this.systemAlertService = systemAlertService;
    }

    private void alert(String message) {
        if (systemAlertService != null) systemAlertService.raise("discord", message);
    }

    public DiscordRoleServiceImpl(
            @Value("${app.discord.bot-token:}") String botToken,
            @Value("${app.discord.guild-id:}") String guildId,
            @Value("${app.discord.verified-role-id:}") String verifiedRoleId,
            @Value("${app.discord.supporter-role-id:}") String supporterRoleId) {
        this.botToken = botToken;
        this.guildId = guildId;
        this.verifiedRoleId = verifiedRoleId;
        this.supporterRoleId = supporterRoleId;
    }

    private boolean enabled(String roleId) {
        return !botToken.isBlank() && !guildId.isBlank() && !roleId.isBlank();
    }

    @Override
    @Async
    public void assignVerifiedRole(String discordUserId) {
        assignRole(discordUserId, verifiedRoleId, "verified");
    }

    @Override
    @Async
    public void assignSupporterRole(String discordUserId) {
        assignRole(discordUserId, supporterRoleId, "supporter");
    }

    private void assignRole(String discordUserId, String roleId, String label) {
        if (!enabled(roleId)) {
            log.debug("Discord bot not configured — skipping '{}' role for {}", label, discordUserId);
            return;
        }
        if (discordUserId == null || discordUserId.isBlank()) {
            return;
        }

        String url = API_BASE + "/guilds/" + guildId + "/members/" + discordUserId + "/roles/" + roleId;
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(10))
                    .header("Authorization", "Bot " + botToken)
                    .header("User-Agent", "Freenote (https://freenote.be, 1.0)")
                    .PUT(HttpRequest.BodyPublishers.noBody())
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            if (status / 100 == 2) {
                log.info("Discord: '{}' role granted to {}", label, discordUserId);
            } else if (status == 404) {
                log.info("Discord: user {} not in the guild yet — '{}' role not granted (needs a re-sync when they join)", discordUserId, label);
            } else if (status == 403) {
                log.warn("Discord: forbidden (403) for {} — check the bot's 'Manage Roles' permission AND that the bot role is ABOVE the '{}' role", discordUserId, label);
                alert("Le bot n'a pas le droit d'attribuer le rôle « " + label + " » (403) : permission « Gérer les rôles » ou rôle du bot placé trop bas");
            } else if (status == 401) {
                log.error("Discord: unauthorized (401) — invalid bot token (app.discord.bot-token)");
                alert("Jeton du bot Discord refusé (401) : plus aucun rôle n'est attribué");
            } else if (status == 429) {
                log.warn("Discord: rate-limited (429) for {}", discordUserId);
            } else {
                log.warn("Discord: unexpected status {} for {} — {}", status, discordUserId, response.body());
            }
        } catch (Exception e) {
            // Async fire-and-forget: a Discord hiccup must never affect the calling flow.
            log.warn("Discord '{}' role assignment failed for {}: {}", label, discordUserId, e.getMessage());
        }
    }

    @Override
    public DmResult sendDirectMessage(String discordUserId, String content) {
        if (botToken.isBlank()) return DmResult.DISABLED;
        if (discordUserId == null || discordUserId.isBlank()) return DmResult.UNREACHABLE;
        try {
            HttpResponse<String> channel = post("/users/@me/channels", Map.of("recipient_id", discordUserId));
            if (channel.statusCode() / 100 != 2) return dmFailure(channel, discordUserId);
            String channelId = JSON.readTree(channel.body()).path("id").asString();
            HttpResponse<String> sent = post("/channels/" + channelId + "/messages", Map.of("content", content));
            if (sent.statusCode() / 100 == 2) {
                log.info("Discord: direct message sent to {}", discordUserId);
                return DmResult.SENT;
            }
            return dmFailure(sent, discordUserId);
        } catch (Exception e) {
            log.warn("Discord direct message to {} failed: {}", discordUserId, e.getMessage());
            return DmResult.FAILED;
        }
    }

    private HttpResponse<String> post(String path, Map<String, String> body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(API_BASE + path))
                .timeout(Duration.ofSeconds(10))
                .header("Authorization", "Bot " + botToken)
                .header("User-Agent", "Freenote (https://freenote.be, 1.0)")
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)))
                .build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private DmResult dmFailure(HttpResponse<String> response, String discordUserId) {
        int status = response.statusCode();
        // 403 / code 50007 : MP fermés, ou l'utilisateur n'a quitté / jamais rejoint le serveur du bot.
        if (status == 403 || status == 400) return DmResult.UNREACHABLE;
        if (status == 401) alert("Jeton du bot Discord refusé (401) : plus aucun rôle n'est attribué");
        log.warn("Discord direct message to {}: HTTP {} — {}", discordUserId, status, response.body());
        return DmResult.FAILED;
    }
}
