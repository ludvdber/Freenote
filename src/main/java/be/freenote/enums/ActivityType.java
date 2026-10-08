package be.freenote.enums;

/** Kinds of events recorded in the admin activity log (audit trail). */
public enum ActivityType {
    LOGIN,
    SIGNUP,
    UPLOAD,
    DOC_DELETE,
    DOC_VERIFY,
    USER_BAN,

    // Parcours de vérification e-mail (2026-10-08). Un « je ne reçois jamais le mail » doit se
    // diagnostiquer depuis le panel : sans ces lignes, un envoi réussi ne laissait aucune trace et
    // rien ne distinguait une demande bloquée d'un mail perdu après l'envoi. Le préfixe commun
    // sert au filtre « EMAIL_* » du panel ; l'adresse n'apparaît que masquée.
    /** Code créé et mail accepté par le serveur SMTP — la suite dépend du fournisseur. */
    EMAIL_CODE_SENT,
    /** Demande refusée avant l'envoi : adresse hors @isfce.be, déjà liée à un autre compte, bannie. */
    EMAIL_CODE_BLOCKED,
    /** Le serveur SMTP a refusé l'envoi (clé désactivée, quota, panne). */
    EMAIL_SEND_FAILED,
    /** Code saisi faux, expiré ou trop d'essais. */
    EMAIL_CODE_REJECTED,
    /** Adresse confirmée : le compte devient vérifié. */
    EMAIL_VERIFIED,

    /** Un compte connecté a atteint une limite de débit — une ligne par fenêtre, pas par appel refusé. */
    RATE_LIMITED
}
