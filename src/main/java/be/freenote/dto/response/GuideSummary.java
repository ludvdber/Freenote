package be.freenote.dto.response;

import java.time.LocalDateTime;

/**
 * Guide list item — no content body (kept light for the index + admin list). {@code readMinutes}
 * is computed server-side from the content word count so the index cards can show it without
 * shipping the Markdown.
 */
public record GuideSummary(
        Long id,
        String slug,
        String title,
        String summary,
        String category,
        String relatedTool,
        String authorName,
        boolean published,
        int readMinutes,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
