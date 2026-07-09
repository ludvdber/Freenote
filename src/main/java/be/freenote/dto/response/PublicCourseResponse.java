package be.freenote.dto.response;

/**
 * Teaser public d'un cours (page /courses/{id} pour un anonyme — SEO). Le catalogue des cours est
 * une donnée publique (source isfce.org) ; seuls des compteurs agrégés sortent, jamais un document
 * hors catégories publiques. Les compteurs couvrent le groupe d'équivalence V15 (comme le listing).
 */
public record PublicCourseResponse(
        Long id,
        String name,
        String sectionName,
        /** Documents vérifiés du cours (toutes catégories) — l'argument du CTA de connexion. */
        long documentCount,
        /** Dont consultables anonymement (catégories publiques NOTES/DIVERS). */
        long publicDocumentCount
) {}
