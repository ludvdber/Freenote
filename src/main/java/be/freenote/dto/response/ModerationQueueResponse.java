package be.freenote.dto.response;

/**
 * Compteurs des files de modération — le sous-ensemble « badges » d'{@link AdminOverviewResponse},
 * exposé séparément pour les MODÉRATEURS (V18) : la vue d'ensemble complète (KPI de fréquentation,
 * journal d'activité) reste réservée aux admins, mais la sidebar du panel doit pouvoir afficher
 * ses badges de file à un modérateur.
 */
public record ModerationQueueResponse(
        long pendingDocs,
        long pendingReports,
        long duplicateGroups
) {}
