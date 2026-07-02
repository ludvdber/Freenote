package be.freenote.dto.response;

import java.time.LocalDateTime;

/** Guide list item — no content body (kept light for the index + admin list). */
public record GuideSummary(
        Long id,
        String slug,
        String title,
        String summary,
        String category,
        String authorName,
        boolean published,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
