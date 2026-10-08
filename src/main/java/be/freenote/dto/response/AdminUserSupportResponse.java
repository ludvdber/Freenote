package be.freenote.dto.response;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Fiche « support » d'un compte : où il en est de son inscription et ce qui le bloque peut-être
 * (code en attente, essais consommés, limites de débit actives). Jamais le code lui-même.
 *
 * @param lastLoginAt null = aucune connexion dans la fenêtre de conservation des LOGIN (30 j)
 * @param pendingCode null = aucun code en attente
 */
public record AdminUserSupportResponse(
        Long id,
        String username,
        boolean usernameChosen,
        boolean verified,
        boolean termsAccepted,
        boolean discordLinked,
        LocalDateTime createdAt,
        LocalDateTime lastLoginAt,
        PendingCode pendingCode,
        String lastEmailEvent,
        String lastEmailMessage,
        LocalDateTime lastEmailEventAt,
        boolean reminded,
        List<ActiveRateLimit> rateLimits
) {
    /** @param attempts essais faux déjà consommés sur les 5 autorisés */
    public record PendingCode(long expiresInSeconds, long attempts) {}

    /** @param endpoint méthode limitée (ex. {@code AuthController.requestVerification}) */
    public record ActiveRateLimit(String endpoint, long count, long retryAfterSeconds) {}
}
