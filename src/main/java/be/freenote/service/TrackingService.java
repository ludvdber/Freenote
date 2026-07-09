package be.freenote.service;

/**
 * Compteurs d'usage anonymes (panel admin Analytics). Un événement = +1 Redis sur
 * (jour, métrique, cible) ; un flush périodique agrège en base ({@code daily_stats}).
 * AUCUNE donnée personnelle : pas de cookie, pas d'identifiant visiteur persisté.
 */
public interface TrackingService {

    /** Métriques serveur (fiables) — incrémentées par les services métier. */
    String METRIC_DOC_VIEW = "doc_view";
    String METRIC_QUIZ_PLAY = "quiz_play";

    /** Métriques client (POST /api/public/track) — whitelistées et validées. */
    String METRIC_VISIT = "visit";
    String METRIC_TOOL = "tool";
    String METRIC_GUIDE = "guide";
    String METRIC_PROFILE = "profile";

    /** +1 sans validation — réservé aux appels internes (métriques serveur). */
    void increment(String metric, String target);

    /**
     * Événement envoyé par le frontend. Valide métrique + cible (whitelist stricte, une entrée
     * invalide est ignorée en silence) ; les vues de profil sont dédupliquées par (profil, viewer)
     * sur 24 h — {@code viewerKey} = id du compte connecté ou IP.
     */
    void trackClientEvent(String metric, String target, String viewerKey);
}
