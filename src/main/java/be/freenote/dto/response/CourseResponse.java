package be.freenote.dto.response;

public record CourseResponse(
        Long id,
        String name,
        Long sectionId,
        String sectionName,
        long documentCount,
        boolean approved,
        /** Groupe d'équivalence V15 (même cours dans plusieurs sections) — null = non lié. */
        Long equivalenceGroup
) {}
