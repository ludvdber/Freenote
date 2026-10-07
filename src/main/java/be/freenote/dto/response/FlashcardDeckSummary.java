package be.freenote.dto.response;

import java.time.LocalDateTime;
import java.util.List;

/** List-view projection of a deck — no card payload, to keep listings light.
 *  {@code owned}/{@code published} : mêmes sémantiques que {@link QuizSummary}. */
public record FlashcardDeckSummary(
        Long id,
        String title,
        String description,
        int cardCount,
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
    public FlashcardDeckSummary withLinkedCourses(List<LinkedCourseRef> linked) {
        return new FlashcardDeckSummary(id, title, description, cardCount, ownerName, courseId, courseName,
                sectionId, sectionName, createdAt, published, owned, linked);
    }
}
