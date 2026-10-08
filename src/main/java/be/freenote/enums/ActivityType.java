package be.freenote.enums;

import java.util.Arrays;
import java.util.List;

/**
 * Kinds of events recorded in the admin activity log (audit trail). Each type carries its
 * retention class: the trace of a staff decision must outlive the noise of daily logins.
 */
public enum ActivityType {
    LOGIN(Retention.SHORT),
    SIGNUP(Retention.STANDARD),
    UPLOAD(Retention.STANDARD),
    DOC_DELETE(Retention.AUDIT),
    DOC_VERIFY(Retention.AUDIT),
    USER_BAN(Retention.AUDIT),
    /** Toute autre décision du staff (rôles, vérification manuelle, signalements, dons, réglages…) — le message dit laquelle. */
    STAFF_ACTION(Retention.AUDIT),
    /** Panne détectée par l'application (SMTP, Discord, Ko-fi, Meilisearch, erreur 500) — une ligne par jour et par panne. */
    SYSTEM_ALERT(Retention.STANDARD),

    // Parcours de vérification e-mail : le préfixe commun sert au filtre « EMAIL_* » du panel.
    /** Code créé et mail accepté par le serveur SMTP — la suite dépend du fournisseur. */
    EMAIL_CODE_SENT(Retention.STANDARD),
    /** Demande refusée avant l'envoi : adresse hors @isfce.be, déjà liée à un autre compte, bannie. */
    EMAIL_CODE_BLOCKED(Retention.STANDARD),
    /** Le serveur SMTP a refusé l'envoi (clé désactivée, quota, panne). */
    EMAIL_SEND_FAILED(Retention.STANDARD),
    /** Code saisi faux, expiré ou trop d'essais. */
    EMAIL_CODE_REJECTED(Retention.STANDARD),
    /** Adresse confirmée : le compte devient vérifié. */
    EMAIL_VERIFIED(Retention.STANDARD),

    /** Un compte connecté a atteint une limite de débit — une ligne par fenêtre, pas par appel refusé. */
    RATE_LIMITED(Retention.SHORT);

    /** SHORT = bruit (30 j), STANDARD = {@code app.activity-log.retention-days} (90 j), AUDIT = décisions du staff (1 an). */
    public enum Retention { SHORT, STANDARD, AUDIT }

    private final Retention retention;

    ActivityType(Retention retention) {
        this.retention = retention;
    }

    public Retention retention() {
        return retention;
    }

    public static List<String> namesWith(Retention retention) {
        return Arrays.stream(values()).filter(t -> t.retention == retention).map(Enum::name).toList();
    }
}
