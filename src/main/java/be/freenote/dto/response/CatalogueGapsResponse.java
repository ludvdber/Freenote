package be.freenote.dto.response;

import java.util.List;

/**
 * « Ce qui manque » : les cours approuvés qui n'ont encore AUCUN document, groupés par section.
 *
 * <p>Public et indexable à dessein. Pour un étudiant, c'est la réponse honnête à « pourquoi je ne
 * trouve rien pour ce cours » et un appel au dépôt là où le besoin est réel ; pour les moteurs,
 * c'est une page qui nomme des cours que personne d'autre ne liste. Aucune donnée personnelle : des
 * noms de cours et de sections du référentiel de l'école.</p>
 */
public record CatalogueGapsResponse(
        /** Nombre total de cours du catalogue, pour situer le manque (« 23 sur 146 »). */
        long totalCourses,
        long emptyCourses,
        List<SectionGap> sections
) {
    public record SectionGap(Long sectionId, String sectionName, String icon, List<CourseGap> courses) {}

    public record CourseGap(Long id, String name) {}
}
