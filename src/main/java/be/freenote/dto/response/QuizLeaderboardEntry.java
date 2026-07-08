package be.freenote.dto.response;

import java.time.LocalDateTime;

/** One row of a quiz leaderboard — the user's BEST attempt (score DESC, then duration ASC).
 *  {@code userName} = nom d'affichage ; {@code username} = identifiant technique brut (seed
 *  stable de l'avatar lettre/DiceBear — convention UserAvatar). */
public record QuizLeaderboardEntry(
        int rank,
        Long userId,
        String userName,
        String username,
        String avatarUrl,
        int score,
        int total,
        long durationMs,
        LocalDateTime achievedAt
) {}
