package be.freenote.dto.response;

import java.util.List;

/**
 * A quiz served for playing — questions WITHOUT the graded answer ({@code answer}/{@code openAnswer}
 * are dropped). This is what prevents a player from reading the solution off the network response.
 */
public record QuizPlayResponse(
        Long id,
        String title,
        String description,
        List<QuizPlayQuestion> questions
) {
    /** A question stripped of its answer — keeps the renderable content (choices, image, code). */
    public record QuizPlayQuestion(
            String type,
            String question,
            List<String> choices,
            String image,
            String code,
            String language
    ) {}
}
