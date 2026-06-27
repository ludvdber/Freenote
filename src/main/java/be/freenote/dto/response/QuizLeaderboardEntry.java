package be.freenote.dto.response;

import java.time.LocalDateTime;

/** One row of a quiz leaderboard — the user's BEST attempt (score DESC, then duration ASC). */
public record QuizLeaderboardEntry(
        int rank,
        Long userId,
        String userName,
        int score,
        int total,
        long durationMs,
        LocalDateTime achievedAt
) {}
