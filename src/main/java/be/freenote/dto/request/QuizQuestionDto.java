package be.freenote.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * A single question in a create request. The shape depends on {@code type} ("mcq" / "open"); the
 * cross-field rules (mcq → ≥2 non-blank choices + answer in range ; open → non-blank openAnswer) are
 * enforced in the service. Sizes are capped here; {@code image} is a base64 data URI (≈ a 200 KB image).
 */
public record QuizQuestionDto(
        String type,
        @NotBlank @Size(max = 500) String question,
        @Size(max = 6) List<@Size(max = 200) String> choices,
        // Integer, pas int : une question ouverte n'a pas d'index de réponse et le client peut
        // omettre le champ — Jackson 3 refuse de mapper null/absent vers un primitif (500 sinon).
        Integer answer,
        @Size(max = 200) String openAnswer,
        @Size(max = 300_000) String image,
        @Size(max = 5000) String code,
        @Size(max = 30) String language,
        @Size(max = 1000) String explanation
) {}
