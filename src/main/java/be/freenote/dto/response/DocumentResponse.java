package be.freenote.dto.response;

import java.time.LocalDateTime;

public record DocumentResponse(
        Long id,
        String title,
        Long courseId,
        String courseName,
        String sectionName,
        String category,
        String authorName,
        Long authorId,
        boolean verified,
        boolean aiGenerated,
        String language,
        String year,
        String professorName,
        double averageRating,
        int downloadCount,
        LocalDateTime createdAt
) {}
