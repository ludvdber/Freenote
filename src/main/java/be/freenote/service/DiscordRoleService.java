package be.freenote.service;

/**
 * Grants the ISFCE Discord "verified" role to a member once their Freenote account has confirmed
 * its {@code @isfce.be} email. MVP "REST-push" model: the backend (which already holds the user's
 * Discord ID via {@code user_oauth_links}) calls the Discord REST API with the bot token — no
 * always-on gateway process. No-op when the bot is not configured.
 */
public interface DiscordRoleService {

    /**
     * Asynchronously assigns the configured "verified" role to the given Discord user on the
     * configured guild. Never throws — a Discord outage must not affect the verification flow.
     *
     * @param discordUserId the Discord snowflake (the {@code oauth_id} of the user's DISCORD link)
     */
    void assignVerifiedRole(String discordUserId);
}
