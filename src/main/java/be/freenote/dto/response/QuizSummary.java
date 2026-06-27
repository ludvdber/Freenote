package be.freenote.dto.response;

import java.time.LocalDateTime;

/** List-view projection of a shared quiz — no question payload, to keep listings light. */
public record QuizSummary(
        Long id,
        String title,
        String description,
        int questionCount,
        int attemptCount,
        String ownerName,
        Long courseId,
        String courseName,
        LocalDateTime createdAt
) {}
