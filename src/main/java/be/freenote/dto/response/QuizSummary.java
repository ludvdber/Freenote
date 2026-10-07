package be.freenote.dto.response;

import java.time.LocalDateTime;
import java.util.List;

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
        Long sectionId,
        String sectionName,
        LocalDateTime createdAt,
        boolean published,
        boolean owned,
        /** Équivalents du cours dans d'autres sections (vide si non lié, ou hors bibliothèque). */
        List<LinkedCourseRef> linkedCourses
) {
    public QuizSummary withLinkedCourses(List<LinkedCourseRef> linked) {
        return new QuizSummary(id, title, description, questionCount, attemptCount, ownerName, courseId, courseName,
                sectionId, sectionName, createdAt, published, owned, linked);
    }
}
