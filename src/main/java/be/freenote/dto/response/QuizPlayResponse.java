package be.freenote.dto.response;

import java.util.List;

/**
 * A quiz served for playing — questions WITHOUT the correct answer (the server grades on submit). This
 * is what prevents a player from reading the answers off the network response.
 */
public record QuizPlayResponse(
        Long id,
        String title,
        String description,
        List<QuizPlayQuestion> questions
) {
    /** A question stripped of its answer index. */
    public record QuizPlayQuestion(String question, List<String> choices) {}
}
