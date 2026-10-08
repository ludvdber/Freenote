package be.freenote.dto.response;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Ce qui demande l'attention d'un admin hors modération : santé de l'envoi des mails, alertes
 * système non acquittées, comptes restés bloqués à l'inscription.
 */
public record AdminAttentionResponse(
        SmtpStatusResponse smtp,
        long systemAlerts,
        List<StuckAccount> stuckAccounts
) {
    /**
     * @param lastEmailEvent type EMAIL_* le plus récent (null = n'a jamais demandé de code)
     * @param reminded       relancé sur Discord dans les dernières 24 h
     */
    public record StuckAccount(
            Long id,
            String username,
            boolean usernameChosen,
            LocalDateTime createdAt,
            String lastEmailEvent,
            String lastEmailMessage,
            LocalDateTime lastEmailEventAt,
            boolean reminded
    ) {}
}
