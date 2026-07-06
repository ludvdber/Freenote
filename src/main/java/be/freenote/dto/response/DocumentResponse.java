package be.freenote.dto.response;

import java.time.LocalDateTime;

public record DocumentResponse(
        Long id,
        String title,
        Long courseId,
        String courseName,
        String sectionName,
        String category,
        String authorName,
        Long authorId,
        boolean verified,
        boolean aiGenerated,
        String language,
        String year,
        String professorName,
        double averageRating,
        // Nombre de votes — permet au front d'afficher « 4,3 (12) » et de MASQUER les étoiles
        // vides quand personne n'a voté (des ☆☆☆☆☆ se lisaient comme « note 0 »).
        int ratingCount,
        int downloadCount,
        // Avatar résolu de l'uploader (même logique que les profils) — null pour les docs anonymes
        // ou les avatars « lettre ». Affiché en 20 px devant le nom sur les cartes de l'explorer.
        String authorAvatarUrl,
        LocalDateTime createdAt
) {}
