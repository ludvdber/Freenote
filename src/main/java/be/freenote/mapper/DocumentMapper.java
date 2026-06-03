package be.freenote.mapper;

import be.freenote.dto.response.DocumentResponse;
import be.freenote.entity.Document;
import org.mapstruct.*;

@Mapper(componentModel = "spring")
public interface DocumentMapper {

    @Mapping(target = "courseId", source = "course.id")
    @Mapping(target = "courseName", source = "course.name")
    @Mapping(target = "sectionName", source = "course.section.name")
    @Mapping(target = "category", source = "category")
    @Mapping(target = "authorName", expression = "java(mapAuthorName(document))")
    @Mapping(target = "authorId", expression = "java(mapAuthorId(document))")
    @Mapping(target = "professorName", source = "professor.name")
    @Mapping(target = "averageRating", expression = "java(document.getAverageRating().doubleValue())")
    @Mapping(target = "downloadCount", source = "downloadCount")
    DocumentResponse toResponse(Document document);

    default String mapAuthorName(Document document) {
        if (document.isAnonymous() || document.getUser() == null) {
            return "Anonyme";
        }
        // Honour the uploader's "display real name" preference everywhere their name appears.
        var user = document.getUser();
        return UserMapper.resolveDisplayName(user.getProfile(), user.getUsername());
    }

    /** Null for anonymous docs (or no author) so the frontend can't link to the uploader's profile. */
    default Long mapAuthorId(Document document) {
        if (document.isAnonymous() || document.getUser() == null) {
            return null;
        }
        return document.getUser().getId();
    }
}
