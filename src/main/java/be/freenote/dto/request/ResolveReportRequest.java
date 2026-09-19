package be.freenote.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Décision de modération sur un signalement (V19).
 *
 * <p>Avant, « Résoudre » et « Rejeter » ne faisaient rigoureusement rien d'autre qu'écrire un
 * statut : le bouton rangeait la ligne en laissant croire qu'on avait agi. Ici l'admin déclare ce
 * qu'il fait, et le serveur le FAIT (retrait de vérification, suppression) puis prévient le
 * signaleur — et l'auteur du document quand celui-ci est touché.
 */
@Data
public class ResolveReportRequest {

    /**
     * Valeur de {@link be.freenote.enums.ReportResolution} : NO_ACTION, EDITED, UNVERIFIED,
     * DELETED ou REJECTED. Les corrections de métadonnées (EDITED) se font via l'édition du
     * document ; on ne fait qu'enregistrer ici que c'est ce qui a été décidé.
     */
    private String resolution;

    /** Mot renvoyé au signaleur (« merci, corrigé », « le doc est bien à jour »…). Facultatif. */
    @Size(max = 500, message = "Note must not exceed 500 characters")
    private String note;
}
