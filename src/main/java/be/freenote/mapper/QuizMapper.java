package be.freenote.mapper;

import be.freenote.dto.response.QuizPlayResponse;
import be.freenote.dto.response.QuizPlayResponse.QuizPlayQuestion;
import be.freenote.dto.response.QuizSummary;
import be.freenote.entity.Quiz;
import be.freenote.entity.User;

import java.util.List;

/**
 * Static quiz → DTO mapping. The owner display name honours the "show real name" preference via
 * {@link UserMapper#resolveDisplayName}; an orphaned quiz (owner deleted) shows "Anonyme". The play
 * projection deliberately drops each question's answer index (server-side grading only).
 */
public final class QuizMapper {

    private QuizMapper() {}

    public static QuizSummary toSummary(Quiz q) {
        return new QuizSummary(
                q.getId(), q.getTitle(), q.getDescription(), q.getQuestionCount(), q.getAttemptCount(),
                ownerName(q), courseId(q), courseName(q), q.getCreatedAt());
    }

    public static QuizPlayResponse toPlay(Quiz q) {
        List<QuizPlayQuestion> questions = q.getQuestions().stream()
                .map(qq -> new QuizPlayQuestion(
                        qq.type(), qq.question(), qq.choices(), qq.image(), qq.code(), qq.language()))
                .toList();
        return new QuizPlayResponse(q.getId(), q.getTitle(), q.getDescription(), questions);
    }

    private static String ownerName(Quiz q) {
        User o = q.getOwner();
        return o == null ? "Anonyme" : UserMapper.resolveDisplayName(o.getProfile(), o.getUsername());
    }

    private static Long courseId(Quiz q) {
        return q.getCourse() == null ? null : q.getCourse().getId();
    }

    private static String courseName(Quiz q) {
        return q.getCourse() == null ? null : q.getCourse().getName();
    }
}
