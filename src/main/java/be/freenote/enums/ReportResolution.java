package be.freenote.enums;

/**
 * Ce que la modération a RÉELLEMENT fait d'un signalement (V19).
 *
 * <p>Le statut seul ({@link ReportStatus}) ne disait que « sorti de la file ». La résolution dit
 * quoi : elle est renvoyée au signaleur dans sa notification et reste lisible dans l'historique.
 */
public enum ReportResolution {
    /** Signalement fondé, mais rien à changer sur le document (déjà corrigé, cas limite assumé). */
    NO_ACTION,
    /** Le document a été corrigé (titre, cours, catégorie, professeur, année). */
    EDITED,
    /** La vérification a été retirée : le document reste en ligne mais n'est plus mis en avant. */
    UNVERIFIED,
    /** Le document a été supprimé. */
    DELETED,
    /** Signalement non retenu. */
    REJECTED
}
