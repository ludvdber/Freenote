package be.freenote.service;

import be.freenote.dto.request.CreateQuizRequest;
import be.freenote.dto.request.SubmitAttemptRequest;
import be.freenote.dto.response.AttemptResultResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.dto.response.QuizLeaderboardEntry;
import be.freenote.dto.response.QuizPlayResponse;
import be.freenote.dto.response.QuizSummary;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface QuizService {

    QuizSummary create(Long userId, CreateQuizRequest request);

    PageResponse<QuizSummary> list(Long courseId, Pageable pageable);

    /** Questions WITHOUT the answer index — the playable view. */
    QuizPlayResponse play(Long id);

    /** Grade a finished play server-side and persist the attempt. */
    AttemptResultResponse submit(Long userId, Long quizId, SubmitAttemptRequest request);

    /** Best attempt per user, ranked (score DESC, duration ASC), capped to {@code size}. */
    List<QuizLeaderboardEntry> leaderboard(Long quizId, int size);

    /** Delete a shared quiz — allowed for its owner or an admin (moderation). */
    void delete(Long userId, boolean isAdmin, Long id);
}
