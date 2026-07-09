package be.freenote.service.impl;

import be.freenote.service.DiscordRoleService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

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

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

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
            } else if (status == 401) {
                log.error("Discord: unauthorized (401) — invalid bot token (app.discord.bot-token)");
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
}
