package be.freenote.dto.response;

import java.time.LocalDateTime;

/** List-view projection of a quiz — no question payload, to keep listings light.
 *  {@code owned} is computed for the calling user (drives the edit/delete actions in the UI);
 *  {@code published} distinguishes a private save from a library entry in the "Mes quiz" view. */
public record QuizSummary(
        Long id,
        String title,
        String description,
        int questionCount,
        int attemptCount,
        String ownerName,
        Long courseId,
        String courseName,
        LocalDateTime createdAt,
        boolean published,
        boolean owned
) {}
