package be.freenote.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Payload to publish a local quiz to the shared catalogue. */
public record CreateQuizRequest(
        @NotBlank @Size(max = 100) String title,
        @Size(max = 500) String description,
        Long courseId,
        @NotEmpty @Size(max = 100) @Valid List<QuizQuestionDto> questions
) {}
