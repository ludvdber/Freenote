package be.freenote.service;

import be.freenote.dto.request.CreateQuizRequest;
import be.freenote.dto.request.QuizQuestionDto;
import be.freenote.dto.request.SubmitAttemptRequest;
import be.freenote.dto.response.AttemptResultResponse;
import be.freenote.dto.response.QuizLeaderboardEntry;
import be.freenote.dto.response.QuizSummary;
import be.freenote.entity.Quiz;
import be.freenote.entity.QuizAttempt;
import be.freenote.entity.QuizQuestionJson;
import be.freenote.entity.User;
import be.freenote.exception.ForbiddenException;
import be.freenote.repository.CourseRepository;
import be.freenote.repository.QuizAttemptRepository;
import be.freenote.repository.QuizRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.impl.QuizServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QuizServiceImplTest {

    @Mock private QuizRepository quizRepository;
    @Mock private QuizAttemptRepository attemptRepository;
    @Mock private UserRepository userRepository;
    @Mock private CourseRepository courseRepository;

    @InjectMocks private QuizServiceImpl service;

    private User testUser(Long id) {
        return User.builder().id(id).username("user" + id).build();
    }

    private QuizQuestionDto mcq(String question, int answer, String... choices) {
        return new QuizQuestionDto("mcq", question, List.of(choices), answer, null, null, null, null);
    }

    private QuizQuestionDto open(String question, String expected) {
        return new QuizQuestionDto("open", question, null, -1, expected, null, null, null);
    }

    private QuizQuestionJson mcqJson(String question, int answer, String... choices) {
        return new QuizQuestionJson("mcq", question, List.of(choices), answer, "", null, null, null);
    }

    private QuizAttempt attempt(Long userId, int score, long durationMs) {
        return QuizAttempt.builder().id(userId).user(testUser(userId)).score(score).total(5).durationMs(durationMs).build();
    }

    @Test
    void shouldCreateQuizTrimmingAndCountingQuestions() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        when(quizRepository.save(any(Quiz.class))).thenAnswer(inv -> inv.getArgument(0));

        var request = new CreateQuizRequest("  Réseaux — OSI  ", "  desc  ", null,
                List.of(mcq("  Couche transport ?  ", 1, " UDP ", " TCP "),
                        open("Résultat de 2+2 ?", " 4 ")));

        QuizSummary res = service.create(1L, request);

        assertThat(res.title()).isEqualTo("Réseaux — OSI");
        assertThat(res.description()).isEqualTo("desc");
        assertThat(res.questionCount()).isEqualTo(2);
        assertThat(res.ownerName()).isEqualTo("user1");
        verify(courseRepository, never()).findById(any()); // no courseId → no lookup
    }

    @Test
    void shouldRejectMcqAnswerIndexOutOfRange() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        var request = new CreateQuizRequest("Bad", null, null,
                List.of(mcq("Q", 5, "A", "B"))); // answer 5 but only 2 choices

        assertThatThrownBy(() -> service.create(1L, request))
                .isInstanceOf(IllegalArgumentException.class);
        verify(quizRepository, never()).save(any());
    }

    @Test
    void shouldRejectOpenQuestionWithoutExpectedAnswer() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        var request = new CreateQuizRequest("Bad", null, null,
                List.of(open("Q", "   "))); // blank expected answer

        assertThatThrownBy(() -> service.create(1L, request))
                .isInstanceOf(IllegalArgumentException.class);
        verify(quizRepository, never()).save(any());
    }

    @Test
    void shouldGradeMcqServerSideAndClampDuration() {
        Quiz quiz = Quiz.builder().id(7L).questionCount(3)
                .questions(List.of(
                        mcqJson("Q1", 0, "a", "b"),
                        mcqJson("Q2", 1, "a", "b"),
                        mcqJson("Q3", 0, "a", "b")))
                .build();
        when(quizRepository.findById(7L)).thenReturn(Optional.of(quiz));
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        when(attemptRepository.save(any(QuizAttempt.class))).thenAnswer(inv -> inv.getArgument(0));
        when(attemptRepository.findForLeaderboard(eq(7L), any())).thenReturn(List.of(attempt(1L, 2, 0)));

        // chosen ["0","1","1"] → Q1 ✓ Q2 ✓ Q3 ✗ = 2/3 ; negative duration clamped to 0
        AttemptResultResponse res = service.submit(1L, 7L,
                new SubmitAttemptRequest(List.of("0", "1", "1"), -50));

        assertThat(res.score()).isEqualTo(2);
        assertThat(res.total()).isEqualTo(3);
        assertThat(res.durationMs()).isZero();
        assertThat(res.correct()).containsExactly(true, true, false);
        assertThat(res.correctAnswers()).containsExactly("a", "b", "a"); // display text of the right choice
        assertThat(res.rank()).isEqualTo(1);
        verify(attemptRepository).save(any(QuizAttempt.class));
        verify(quizRepository).incrementAttemptCount(7L);
    }

    @Test
    void shouldGradeOpenAnswerNormalised() {
        Quiz quiz = Quiz.builder().id(7L).questionCount(2)
                .questions(List.of(
                        new QuizQuestionJson("open", "2+2 ?", List.of(), -1, "4", null, null, null),
                        new QuizQuestionJson("open", "Capitale ?", List.of(), -1, "Bruxelles", null, null, null)))
                .build();
        when(quizRepository.findById(7L)).thenReturn(Optional.of(quiz));
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        when(attemptRepository.save(any(QuizAttempt.class))).thenAnswer(inv -> inv.getArgument(0));
        when(attemptRepository.findForLeaderboard(eq(7L), any())).thenReturn(List.of(attempt(1L, 2, 0)));

        // "  4 " matches "4" ; "BRUXELLES" matches "Bruxelles" (case/space-insensitive)
        AttemptResultResponse res = service.submit(1L, 7L,
                new SubmitAttemptRequest(List.of("  4 ", "BRUXELLES"), 1000));

        assertThat(res.score()).isEqualTo(2);
        assertThat(res.correct()).containsExactly(true, true);
        assertThat(res.correctAnswers()).containsExactly("4", "Bruxelles");
    }

    @Test
    void shouldBuildLeaderboardKeepingBestAttemptPerUser() {
        Quiz quiz = Quiz.builder().id(7L).build();
        when(quizRepository.findById(7L)).thenReturn(Optional.of(quiz));
        // Repository returns rows already ordered best-first (score DESC, duration ASC).
        when(attemptRepository.findForLeaderboard(eq(7L), any())).thenReturn(List.of(
                attempt(1L, 5, 1000), // user1 best
                attempt(2L, 5, 2000), // user2 best
                attempt(1L, 4, 500))); // user1 worse → ignored

        List<QuizLeaderboardEntry> board = service.leaderboard(7L, 10);

        assertThat(board).hasSize(2);
        assertThat(board.get(0).rank()).isEqualTo(1);
        assertThat(board.get(0).userId()).isEqualTo(1L);
        assertThat(board.get(0).durationMs()).isEqualTo(1000);
        assertThat(board.get(1).rank()).isEqualTo(2);
        assertThat(board.get(1).userId()).isEqualTo(2L);
    }

    @Test
    void shouldForbidDeletingSomeoneElsesQuiz() {
        Quiz quiz = Quiz.builder().id(7L).owner(testUser(2L)).build();
        when(quizRepository.findById(7L)).thenReturn(Optional.of(quiz));

        assertThatThrownBy(() -> service.delete(1L, false, 7L))
                .isInstanceOf(ForbiddenException.class);
        verify(quizRepository, never()).delete(any());
    }

    @Test
    void shouldLetAdminDeleteAnyQuiz() {
        Quiz quiz = Quiz.builder().id(7L).owner(testUser(2L)).build();
        when(quizRepository.findById(7L)).thenReturn(Optional.of(quiz));

        service.delete(99L, true, 7L);

        verify(quizRepository).delete(quiz);
    }
}
