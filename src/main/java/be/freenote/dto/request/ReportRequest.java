package be.freenote.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ReportRequest {

    /**
     * Nature du problème ({@link be.freenote.enums.ReportType}). Absent ou inconnu → AUTRE : on ne
     * rejette jamais un signalement pour un type mal orthographié, le message porte l'information.
     */
    private String type;

    /** Message de l'étudiant — obligatoire quel que soit le type : « OBSOLETE » seul n'apprend rien. */
    @NotBlank(message = "Reason is required")
    @Size(max = 1000, message = "Reason must not exceed 1000 characters")
    private String reason;
}
