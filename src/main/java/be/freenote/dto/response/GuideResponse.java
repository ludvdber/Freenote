package be.freenote.dto.response;

import java.time.LocalDateTime;

/** Full guide, including the Markdown {@code content} (rendered + sanitised on the client). */
public record GuideResponse(
        Long id,
        String slug,
        String title,
        String summary,
        String content,
        String category,
        String relatedTool,
        String authorName,
        boolean published,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
