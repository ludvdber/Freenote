package be.freenote.entity;

import java.util.List;

/**
 * One question stored inside the {@code quizzes.questions} JSONB array. Two kinds, by {@code type}:
 * <ul>
 *   <li>{@code "mcq"} — multiple choice: {@code choices} + {@code answer} (0-based correct index).</li>
 *   <li>{@code "open"} — free answer: {@code openAnswer} (the expected text/number, matched normalised).</li>
 * </ul>
 * {@code answer}/{@code openAnswer} are the secret graded values — NEVER sent to a player (the server
 * grades). Optional rich content: {@code image} (a base64 data URI, published quizzes only — stripped
 * from the ephemeral URL-share), {@code code} + {@code language} (a syntax-highlighted snippet, e.g. to
 * ask the output of an algorithm). Plain text, React escapes at render.
 */
public record QuizQuestionJson(
        String type,
        String question,
        List<String> choices,
        int answer,
        String openAnswer,
        String image,
        String code,
        String language
) {}
