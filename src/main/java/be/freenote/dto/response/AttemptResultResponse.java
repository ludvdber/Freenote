package be.freenote.dto.response;

import java.util.List;

/**
 * Result of a graded attempt, revealed only AFTER submitting so nothing leaks during play.
 * {@code correct[i]} is whether question i was answered correctly; {@code correctAnswers[i]} is the
 * display text of the right answer (the correct choice for an MCQ, the expected text for an open one)
 * for the review screen. {@code rank} is the player's best position on this quiz's leaderboard.
 */
public record AttemptResultResponse(
        int score,
        int total,
        long durationMs,
        List<Boolean> correct,
        List<String> correctAnswers,
        int rank
) {}
