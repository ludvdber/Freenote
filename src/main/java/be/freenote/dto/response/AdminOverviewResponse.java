package be.freenote.dto.response;

import java.time.LocalDate;
import java.util.List;

/**
 * Accueil « Vue d'ensemble » du panel admin : badges de file d'attente, KPI 7 jours (valeur +
 * période précédente pour le delta, calculé côté client) et série d'activité 14 jours.
 */
public record AdminOverviewResponse(
        long pendingDocs,
        long pendingReports,
        long duplicateGroups,
        Kpi visits7d,
        Kpi docViews7d,
        Kpi quizPlays7d,
        Kpi signups7d,
        List<DayActivity> activity14d
) {
    /** value = période courante, previous = période précédente de même durée (delta client). */
    public record Kpi(long value, long previous) {}

    public record DayActivity(LocalDate day, long visits, long docViews, long quizPlays) {}
}
