package be.freenote.dto.response;

/** Stats agrégées d'un profil public (tuiles /users/:id) — endpoint dédié comme /rank,
 *  pour ne pas gonfler UserResponse (et son scrub de confidentialité) avec des champs
 *  qui ne servent que sur la page profil. */
public record UserStatsResponse(
        // Somme des vues (downloadCount) de tous ses documents.
        long totalViews,
        // Moyenne des notes reçues sur l'ensemble de ses documents — null si aucun vote.
        Double avgRatingReceived,
        // Vues de la page profil (agrégat anonyme daily_stats, dédup 24 h par visiteur).
        long profileViews
) {}
