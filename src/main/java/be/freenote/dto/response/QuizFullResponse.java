package be.freenote.dto.response;

import be.freenote.dto.request.QuizQuestionDto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Full editable view of a quiz, ANSWERS INCLUDED — served to its owner (édition d'un quiz enregistré)
 * and to any verified student for a PUBLISHED quiz (bouton « Importer » : la copie locale doit
 * embarquer les réponses pour rester éditable/jouable hors ligne). Trade-off assumé : importer un quiz
 * publié révèle ses réponses — inhérent au modèle « importer et modifier » (le classement reste un jeu,
 * pas une évaluation).
 */
public record QuizFullResponse(
        Long id,
        String title,
        String description,
        Long courseId,
        String courseName,
        Long sectionId,
        String sectionName,
        boolean published,
        boolean owned,
        LocalDateTime createdAt,
        List<QuizQuestionDto> questions
) {}
