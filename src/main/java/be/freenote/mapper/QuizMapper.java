package be.freenote.mapper;

import be.freenote.dto.request.QuizQuestionDto;
import be.freenote.dto.response.QuizFullResponse;
import be.freenote.dto.response.QuizListRow;
import be.freenote.dto.response.QuizPlayResponse;
import be.freenote.dto.response.QuizPlayResponse.QuizPlayQuestion;
import be.freenote.dto.response.QuizSummary;
import be.freenote.entity.Quiz;
import be.freenote.entity.User;

import java.util.List;

/**
 * Static quiz → DTO mapping. The owner display name honours the "show real name" preference via
 * {@link UserMapper#resolveDisplayName}; an orphaned quiz (owner deleted) shows "Anonyme". The play
 * projection deliberately drops each question's answer/explanation (server-side grading only); the
 * full projection (edition/import) includes everything.
 */
public final class QuizMapper {

    private QuizMapper() {}

    /** From the light JPQL projection (listings) — no JSONB loaded. */
    public static QuizSummary toSummary(QuizListRow r, Long callerId) {
        String ownerName = r.ownerUsername() == null
                ? "Anonyme"
                : UserMapper.resolveDisplayName(r.ownerDisplayRealName(), r.ownerFirstName(), r.ownerLastName(), r.ownerUsername());
        boolean owned = r.ownerId() != null && r.ownerId().equals(callerId);
        return new QuizSummary(
                r.id(), r.title(), r.description(), r.questionCount(), r.attemptCount(),
                ownerName, r.courseId(), r.courseName(), r.sectionId(), r.sectionName(),
                r.createdAt(), r.published(), owned);
    }

    /** From the entity (create/update responses, where the row is already in memory). */
    public static QuizSummary toSummary(Quiz q, Long callerId) {
        boolean owned = q.getOwner() != null && q.getOwner().getId().equals(callerId);
        return new QuizSummary(
                q.getId(), q.getTitle(), q.getDescription(), q.getQuestionCount(), q.getAttemptCount(),
                ownerName(q), courseId(q), courseName(q), sectionId(q), sectionName(q),
                q.getCreatedAt(), q.isPublished(), owned);
    }

    public static QuizPlayResponse toPlay(Quiz q) {
        List<QuizPlayQuestion> questions = q.getQuestions().stream()
                .map(qq -> new QuizPlayQuestion(
                        qq.type(), qq.question(), qq.choices(), qq.image(), qq.code(), qq.language()))
                .toList();
        return new QuizPlayResponse(q.getId(), q.getTitle(), q.getDescription(), courseId(q), questions);
    }

    /** Full editable view, answers + explanations included — see {@link QuizFullResponse} for access rules. */
    public static QuizFullResponse toFull(Quiz q, Long callerId) {
        boolean owned = q.getOwner() != null && q.getOwner().getId().equals(callerId);
        List<QuizQuestionDto> questions = q.getQuestions().stream()
                .map(qq -> new QuizQuestionDto(qq.type(), qq.question(), qq.choices(), qq.answer(),
                        qq.openAnswer(), qq.image(), qq.code(), qq.language(), qq.explanation()))
                .toList();
        return new QuizFullResponse(q.getId(), q.getTitle(), q.getDescription(),
                courseId(q), courseName(q), sectionId(q), sectionName(q),
                q.isPublished(), owned, q.getCreatedAt(), questions);
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

    private static Long sectionId(Quiz q) {
        return q.getSection() == null ? null : q.getSection().getId();
    }

    private static String sectionName(Quiz q) {
        return q.getSection() == null ? null : q.getSection().getName();
    }
}
