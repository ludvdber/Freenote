package be.freenote.dto.response;

import java.time.LocalDate;
import java.util.List;

/**
 * Page « Analytics » du panel admin. Les visites/outils/guides viennent du tracking anonyme
 * {@code daily_stats} (vide avant le déploiement du tracking — le frontend affiche un état
 * « en cours de collecte ») ; les tops quiz/docs viennent des compteurs dénormalisés (all-time).
 */
public record AnalyticsResponse(
        int days,
        Kpi visits,
        Kpi docViews,
        Kpi quizPlays,
        Kpi guideReads,
        Kpi toolUses,
        Kpi signups,
        List<DayCount> visitsByDay,
        /* Répartition des sources de visite : direct / organic / social / referral / campaign. */
        List<LabelCount> sources,
        List<LabelCount> topTools,
        List<LabelCount> topGuides,
        List<LabelCount> topQuizzes,
        List<LabelCount> topDocs
) {
    /** value = période courante, previous = période précédente de même durée (delta client). */
    public record Kpi(long value, long previous) {}

    public record DayCount(LocalDate day, long count) {}

    /** {@code id} nullable : renseigné pour les tops quiz/docs (le client construit un lien
     *  /documents/{id} ou #play={id}) ; null pour les lignes issues du tracking (le label — slug
     *  d'outil/guide, source de visite — suffit au client). */
    public record LabelCount(String label, long count, Long id) {}
}
