package be.freenote.dto.response;

import java.time.LocalDateTime;

public record DocumentResponse(
        Long id,
        String title,
        Long courseId,
        String courseName,
        // Id de la section — le formulaire d'édition en a besoin pour amorcer la cascade
        // section -> cours (le nom seul ne permet pas de charger la liste des cours).
        Long sectionId,
        String sectionName,
        String category,
        String authorName,
        Long authorId,
        boolean verified,
        boolean aiGenerated,
        String language,
        String year,
        String professorName,
        // Id du professeur — sans lui, le formulaire d'édition ne peut pas pré-sélectionner
        // le prof actuel (il n'avait que le nom affiché).
        Long professorId,
        double averageRating,
        // Nombre de votes — permet au front d'afficher « 4,3 (12) » et de MASQUER les étoiles
        // vides quand personne n'a voté (des ☆☆☆☆☆ se lisaient comme « note 0 »).
        int ratingCount,
        int downloadCount,
        // Avatar résolu de l'uploader (même logique que les profils) — null pour les docs anonymes
        // ou les avatars « lettre ». Affiché en 20 px devant le nom sur les cartes de l'explorer.
        String authorAvatarUrl,
        // Le lecteur est-il l'auteur de ce document ? Renseigné uniquement par getById(id, callerId).
        // Indispensable pour les documents ANONYMES : authorId y vaut null (anonymisation), si bien
        // que le front comparait « null === monId » et retirait à l'auteur les actions sur SON doc.
        boolean owned,
        LocalDateTime createdAt
) {

    /** Copie marquée comme appartenant au lecteur (record = immuable). */
    public DocumentResponse asOwned() {
        return new DocumentResponse(id, title, courseId, courseName, sectionId, sectionName, category,
                authorName, authorId, verified, aiGenerated, language, year, professorName,
                professorId, averageRating, ratingCount, downloadCount, authorAvatarUrl,
                true, createdAt);
    }
}
