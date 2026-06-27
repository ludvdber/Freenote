package be.freenote.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** A single card in a publish request (and echoed back in deck responses). */
public record FlashcardCardDto(
        @NotBlank @Size(max = 2000) String front,
        @Size(max = 2000) String back
) {}
