package be.freenote.service;

/**
 * Compteurs d'usage anonymes (panel admin Analytics). Un événement = +1 Redis sur
 * (jour, métrique, cible) ; un flush périodique agrège en base ({@code daily_stats}).
 * AUCUNE donnée personnelle : pas de cookie, pas d'identifiant visiteur persisté.
 */
public interface TrackingService {

    /**
     * Métriques serveur (fiables) — incrémentées par les services métier.
     *
     * <p>{@code doc_view} et {@code quiz_play} portent <b>l'identifiant</b> de l'objet en cible
     * depuis 2026-10-01 (avant : cible vide). Les totaux ne changent pas — les sommes agrègent
     * toutes cibles confondues — mais c'est ce qui rend possible un « top de la période » au lieu
     * d'un classement all-time figé sur les compteurs dénormalisés.</p>
     */
    String METRIC_DOC_VIEW = "doc_view";
    String METRIC_QUIZ_PLAY = "quiz_play";

    /**
     * Recherche sans résultat, cible = requête normalisée. Serveur et non client : c'est le service
     * de recherche qui sait que Meilisearch n'a rien renvoyé, et la normalisation y est faite une
     * seule fois. Chaque ligne est une demande de contenu formulée par un étudiant.
     */
    String METRIC_SEARCH_MISS = "search_miss";

    /** Métriques client (POST /api/public/track) — whitelistées et validées. */
    String METRIC_VISIT = "visit";
    /** Sous-ensemble de {@code visit} : premier passage de ce navigateur (nouveaux vs habitués). */
    String METRIC_VISIT_NEW = "visit_new";
    /** Cible = valeur de {@code ?src=} — distingue les campagnes entre elles (QR, flyers, posts). */
    String METRIC_CAMPAIGN = "campaign";
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

    /**
     * Enregistre une recherche restée sans résultat. La requête est normalisée ici (minuscules,
     * accents retirés, espaces repliés, longueur bornée) pour que « Compta Analytique » et
     * « comptabilite analytique » ne fassent pas deux lignes distinctes dans le classement.
     * Une requête vide ou réduite à de la ponctuation est ignorée.
     */
    void trackSearchMiss(String query);
}
