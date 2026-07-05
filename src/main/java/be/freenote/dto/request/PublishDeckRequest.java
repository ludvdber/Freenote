package be.freenote.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Payload to publish a local deck to the shared catalogue. */
public record PublishDeckRequest(
        @NotBlank @Size(max = 100) String title,
        @Size(max = 500) String description,
        Long courseId,
        @NotEmpty @Size(max = 1000) List<@Valid FlashcardCardDto> cards,
        /** true = visible dans la bibliotheque partagee ; false = enregistre prive (compte seul). */
        Boolean published  // Boolean nullable : absent/null = prive (Jackson 3 refuse null sur un primitif)
) {}
