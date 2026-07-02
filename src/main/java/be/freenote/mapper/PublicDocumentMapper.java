package be.freenote.mapper;

import be.freenote.dto.response.PublicDocumentSummary;
import be.freenote.entity.Course;
import be.freenote.entity.Document;

/**
 * Maps a Document to its PUBLIC teaser — strips the author and the file key entirely (anonymised,
 * no download surface). Only metadata that is safe to index is exposed.
 */
public final class PublicDocumentMapper {

    private PublicDocumentMapper() {}

    public static PublicDocumentSummary toSummary(Document d) {
        Course course = d.getCourse();
        String courseName = course == null ? null : course.getName();
        String sectionName = course == null || course.getSection() == null ? null : course.getSection().getName();
        return new PublicDocumentSummary(
                d.getId(),
                d.getTitle(),
                courseName,
                sectionName,
                d.getCategory() == null ? null : d.getCategory().name(),
                d.getYear(),
                d.getAverageRating(),
                d.getRatingCount(),
                d.getCreatedAt());
    }
}
