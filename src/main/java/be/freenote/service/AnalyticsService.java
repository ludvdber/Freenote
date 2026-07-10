package be.freenote.service;

import be.freenote.dto.response.AdminOverviewResponse;
import be.freenote.dto.response.AnalyticsResponse;

/** Agrégats du panel admin (Vue d'ensemble + page Analytics) — lecture seule. */
public interface AnalyticsService {

    /** Badges de file d'attente + KPI 7 j + série d'activité 14 j (accueil du panel). */
    AdminOverviewResponse getOverview();

    /** Tableau de bord complet sur {@code days} jours (clampé 7..365). */
    AnalyticsResponse getAnalytics(int days);

    /** Compteurs des files de modération seuls — badges de la sidebar pour un MODÉRATEUR (V18),
     *  qui n'a pas accès à la vue d'ensemble complète. */
    be.freenote.dto.response.ModerationQueueResponse getModerationQueue();
}
