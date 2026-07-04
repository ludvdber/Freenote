package be.freenote.dto.response;

public record LeaderboardEntry(
        Long userId,
        int rank,
        String username,
        String displayName,
        int xp,
        long documentCount,
        boolean supporter,
        String avatarUrl,
        // Parcours ISFCE + rôle communautaire, pour afficher les badges (Promo / Délégué / Ancien délégué)
        // directement dans le classement sans requête par ligne.
        boolean graduated,
        Integer studyEndYear,
        boolean delegate,
        boolean formerDelegate
) {}
