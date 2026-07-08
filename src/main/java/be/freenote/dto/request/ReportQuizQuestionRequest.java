package be.freenote.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Signalement d'une erreur dans UNE question d'un quiz publié — notifie l'auteur (boucle qualité). */
public record ReportQuizQuestionRequest(
        @NotNull @Min(0) Integer questionIndex,
        @Size(max = 300) String message
) {}
