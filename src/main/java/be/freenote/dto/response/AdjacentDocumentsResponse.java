package be.freenote.dto.response;

/** Voisins chronologiques d'un document dans son cours — navigation « précédent/suivant »
 *  de la page document (même pattern que les articles de la page news). Null = pas de voisin. */
public record AdjacentDocumentsResponse(AdjacentDoc previous, AdjacentDoc next) {

    /** Référence minimale (id + titre) — assez pour un lien, sans charger les associations. */
    public record AdjacentDoc(Long id, String title) {}
}
