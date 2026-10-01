package be.freenote.dto.response;

import java.time.LocalDate;
import java.util.List;

/**
 * Page « Analytics » du panel admin, alimentée par le tracking anonyme {@code daily_stats} (vide
 * avant le déploiement du tracking — le frontend affiche un état « en cours de collecte »).
 *
 * <p>Toutes les fenêtres portent sur des <b>jours complets</b> : le jour en cours est exclu des
 * valeurs comme des comparaisons. Auparavant, une période « dont aujourd'hui, incomplet » était
 * comparée à une période complète, si bien que tous les deltas étaient rouges le matin sans que
 * rien n'ait baissé. L'activité du jour reste visible dans la série journalière et dans la vue
 * d'ensemble, là où une journée partielle se lit pour ce qu'elle est.</p>
 */
public record AnalyticsResponse(
        int days,
        /** Dernier jour inclus dans les KPI (= hier) — le frontend l'affiche pour lever l'ambiguïté. */
        LocalDate through,
        Kpi visits,
        /** Visites dont c'était le premier passage de ce navigateur : « le site grandit-il ? ». */
        Kpi newVisitors,
        Kpi docViews,
        Kpi quizPlays,
        Kpi guideReads,
        Kpi toolUses,
        Kpi signups,
        /** Série journalière des visites, jour en cours INCLUS (une journée partielle s'y lit). */
        List<DayCount> visitsByDay,
        /* Répartition des sources de visite : direct / organic / social / referral / campaign. */
        List<LabelCount> sources,
        /** Détail des campagnes (valeurs de {@code ?src=}) — quel QR, quel flyer a fonctionné. */
        List<LabelCount> campaigns,
        List<LabelCount> topTools,
        List<LabelCount> topGuides,
        List<LabelCount> topQuizzes,
        List<LabelCount> topDocs,
        /** Recherches restées sans résultat sur la période : la liste de ce qui manque au catalogue. */
        List<LabelCount> searchMisses
) {
    /** value = période courante, previous = période précédente de même durée (delta client). */
    public record Kpi(long value, long previous) {}

    public record DayCount(LocalDate day, long count) {}

    /** {@code id} nullable : renseigné pour les tops quiz/docs (le client construit un lien
     *  /documents/{id} ou #play={id}) ; null pour les lignes issues du tracking (le label — slug
     *  d'outil/guide, source de visite, requête — suffit au client). */
    public record LabelCount(String label, long count, Long id) {}
}
