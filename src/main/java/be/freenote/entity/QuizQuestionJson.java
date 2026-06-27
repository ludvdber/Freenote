package be.freenote.entity;

import java.util.List;

/**
 * One question as stored inside the {@code quizzes.questions} JSONB array. Plain text — React escapes
 * at render (consistent with document titles / flashcards). {@code answer} is the 0-based index of the
 * correct choice; it is NEVER sent to a player (the server grades) to prevent network-inspection cheating.
 */
public record QuizQuestionJson(String question, List<String> choices, int answer) {}
