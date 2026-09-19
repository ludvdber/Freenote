package be.freenote.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Modification des métadonnées d'un document. Sert DEUX chemins :
 * l'admin/modérateur ({@code PUT /api/admin/documents/{id}}) et le propriétaire du document
 * ({@code PUT /api/documents/{id}}). Sur le chemin propriétaire, {@code verified} est ignoré —
 * personne ne se vérifie soi-même.
 *
 * <p>Sémantique des champs : {@code null} = « ne pas toucher ». Chaque champ non nul remplace la
 * valeur en base.
 */
@Data
public class UpdateDocumentRequest {

    @Size(max = 50, message = "Le titre ne doit pas dépasser 50 caractères")
    private String title;

    private Long courseId;

    private String category;

    private String language;

    @Size(max = 20, message = "Year must not exceed 20 characters")
    private String year;

    private Long professorId;

    /**
     * {@code true} = détacher le professeur (et {@code professorId} est alors ignoré). Nécessaire
     * parce que {@code professorId = null} veut déjà dire « ne pas toucher » : sans ce drapeau, un
     * professeur posé par erreur ne pouvait plus JAMAIS être retiré.
     */
    private Boolean clearProfessor;

    /** Réservé à l'admin/modérateur — ignoré quand c'est le propriétaire qui édite. */
    private Boolean verified;
}
