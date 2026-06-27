package be.freenote.dto.response;

import java.util.List;

/**
 * Result of a graded attempt. {@code correctAnswers} (the 0-based index per question) is revealed only
 * AFTER submitting, so the player can review what they got wrong without it leaking during play.
 * {@code rank} is the player's best position on this quiz's leaderboard after the attempt.
 */
public record AttemptResultResponse(
        int score,
        int total,
        long durationMs,
        List<Integer> correctAnswers,
        int rank
) {}
