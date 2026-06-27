package be.freenote.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * A single multiple-choice question in a create request. {@code answer} is the 0-based index of the
 * correct choice; the upper bound (answer &lt; choices.size()) is a cross-field rule checked in the
 * service. The container-element constraints validate each choice string.
 */
public record QuizQuestionDto(
        @NotBlank @Size(max = 500) String question,
        @NotEmpty @Size(min = 2, max = 6) List<@NotBlank @Size(max = 200) String> choices,
        @Min(0) int answer
) {}
