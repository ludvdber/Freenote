package be.freenote.dto.response;

/**
 * Cours équivalent (V15) d'un quiz ou d'un paquet, avec sa section. Les bibliothèques de révision
 * rangent le contenu par section CÔTÉ CLIENT : sans cette référence, le quiz de « Statistiques »
 * (Informatique) ne pouvait jamais apparaître sous Marketing, où le même cours existe.
 */
public record LinkedCourseRef(Long courseId, String courseName, Long sectionId, String sectionName) {}
