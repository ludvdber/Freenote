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
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.entity.Course;
import be.freenote.entity.Section;
import be.freenote.repository.CourseRepository;
import be.freenote.repository.QuizAttemptRepository;
import be.freenote.repository.QuizRepository;
import be.freenote.repository.SectionRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.impl.QuizServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

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
    @Mock private CourseEquivalenceService courseEquivalenceService;
    @Mock private NotificationService notificationService;
    @Mock private SectionRepository sectionRepository;
    @Mock private be.freenote.service.TrackingService trackingService;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;

    @InjectMocks private QuizServiceImpl service;

    @BeforeEach
    void stubRedis() {
        // Toutes les branches play/submit passent par opsForValue ; get() rend null par défaut
        // (pas d'horodatage serveur → repli sur la durée déclarée, comme après un flush Redis).
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
    }

    private User testUser(Long id) {
        return User.builder().id(id).username("user" + id).build();
    }

    private QuizQuestionDto mcq(String question, int answer, String... choices) {
        return new QuizQuestionDto("mcq", question, List.of(choices), answer, null, null, null, null, null);
    }

    private QuizQuestionDto open(String question, String expected) {
        return new QuizQuestionDto("open", question, null, -1, expected, null, null, null, null);
    }

    private QuizQuestionJson mcqJson(String question, int answer, String... choices) {
        return new QuizQuestionJson("mcq", question, List.of(choices), answer, "", null, null, null, null);
    }

    private CreateQuizRequest request(String title, String description, List<QuizQuestionDto> questions) {
        return new CreateQuizRequest(title, description, null, null, questions, true);
    }

    private QuizAttempt attempt(Long userId, int score, long durationMs) {
        return QuizAttempt.builder().id(userId).user(testUser(userId)).score(score).total(5).durationMs(durationMs).build();
    }

    @Test
    void shouldCreateQuizTrimmingAndCountingQuestions() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        when(quizRepository.save(any(Quiz.class))).thenAnswer(inv -> inv.getArgument(0));

        var request = request("  Réseaux — OSI  ", "  desc  ",
                List.of(mcq("  Couche transport ?  ", 1, " UDP ", " TCP "),
                        open("Résultat de 2+2 ?", " 4 ")));

        QuizSummary res = service.create(1L, request);

        assertThat(res.title()).isEqualTo("Réseaux — OSI");
        assertThat(res.description()).isEqualTo("desc");
        assertThat(res.questionCount()).isEqualTo(2);
        assertThat(res.ownerName()).isEqualTo("user1");
        assertThat(res.published()).isTrue();
        assertThat(res.owned()).isTrue();
        verify(courseRepository, never()).findById(any()); // no courseId → no lookup
    }

    @Test
    void sectionOnlyQuizKeepsTheSection() {
        // Quiz multi-cours « toute la section » : sectionId sans courseId (V13).
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        when(quizRepository.save(any(Quiz.class))).thenAnswer(inv -> inv.getArgument(0));
        Section marketing = Section.builder().id(6L).name("Marketing").build();
        when(sectionRepository.findById(6L)).thenReturn(Optional.of(marketing));

        var request = new CreateQuizRequest("Multi-cours", null, null, 6L,
                List.of(mcq("Q", 0, "A", "B")), true);

        QuizSummary res = service.create(1L, request);

        assertThat(res.sectionId()).isEqualTo(6L);
        assertThat(res.sectionName()).isEqualTo("Marketing");
        assertThat(res.courseId()).isNull();
    }

    @Test
    void chosenCourseImposesItsOwnSection() {
        // Règle de cohérence : le cours choisi impose SA section — le sectionId envoyé est ignoré.
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        when(quizRepository.save(any(Quiz.class))).thenAnswer(inv -> inv.getArgument(0));
        Section info = Section.builder().id(4L).name("Informatique").build();
        Course java = Course.builder().id(9L).name("Java").section(info).build();
        when(courseRepository.findById(9L)).thenReturn(Optional.of(java));

        var request = new CreateQuizRequest("Java", null, 9L, 999L,
                List.of(mcq("Q", 0, "A", "B")), true);

        QuizSummary res = service.create(1L, request);

        assertThat(res.sectionId()).isEqualTo(4L);
        verify(sectionRepository, never()).findById(any());
    }

    @Test
    void shouldCreatePrivateQuizWhenPublishedFalse() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        when(quizRepository.save(any(Quiz.class))).thenAnswer(inv -> inv.getArgument(0));

        var request = new CreateQuizRequest("Privé", null, null, null,
                List.of(mcq("Q", 0, "A", "B")), false);

        QuizSummary res = service.create(1L, request);

        assertThat(res.published()).isFalse();
    }

    @Test
    void shouldRejectMcqAnswerIndexOutOfRange() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        var request = request("Bad", null,
                List.of(mcq("Q", 5, "A", "B"))); // answer 5 but only 2 choices

        assertThatThrownBy(() -> service.create(1L, request))
                .isInstanceOf(IllegalArgumentException.class);
        verify(quizRepository, never()).save(any());
    }

    @Test
    void shouldRejectOpenQuestionWithoutExpectedAnswer() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        var request = request("Bad", null,
                List.of(open("Q", "   "))); // blank expected answer

        assertThatThrownBy(() -> service.create(1L, request))
                .isInstanceOf(IllegalArgumentException.class);
        verify(quizRepository, never()).save(any());
    }

    @Test
    void shouldRejectNonDataUriImage() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        var bad = new QuizQuestionDto("mcq", "Q", List.of("A", "B"), 0, null,
                "https://evil.example/pixel.png", null, null, null);

        assertThatThrownBy(() -> service.create(1L, request("Bad", null, List.of(bad))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("data URI");
        verify(quizRepository, never()).save(any());
    }

    @Test
    void shouldRejectQuizOverTotalContentBound() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        // 8 questions × ~290 k chars d'image = ~2,3 Mo > borne totale de 2 Mo,
        // alors que chaque image respecte individuellement la borne @Size(300_000).
        String bigImage = "data:image/jpeg;base64," + "a".repeat(290_000);
        List<QuizQuestionDto> questions = java.util.stream.IntStream.range(0, 8)
                .mapToObj(i -> new QuizQuestionDto("mcq", "Q" + i, List.of("A", "B"), 0, null,
                        bigImage, null, null, null))
                .toList();

        assertThatThrownBy(() -> service.create(1L, request("Trop lourd", null, questions)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("volumineux");
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
    void shouldClampAbsurdDurationToThreeHours() {
        Quiz quiz = Quiz.builder().id(7L).questionCount(1)
                .questions(List.of(mcqJson("Q1", 0, "a", "b")))
                .build();
        when(quizRepository.findById(7L)).thenReturn(Optional.of(quiz));
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        when(attemptRepository.save(any(QuizAttempt.class))).thenAnswer(inv -> inv.getArgument(0));
        when(attemptRepository.findForLeaderboard(eq(7L), any())).thenReturn(List.of());

        AttemptResultResponse res = service.submit(1L, 7L,
                new SubmitAttemptRequest(List.of("0"), Long.MAX_VALUE));

        assertThat(res.durationMs()).isEqualTo(3L * 3600 * 1000);
    }

    @Test
    void shouldMeasureDurationServerSideFromPlayTimestamp() {
        Quiz quiz = Quiz.builder().id(7L).questionCount(1)
                .questions(List.of(mcqJson("Q1", 0, "a", "b")))
                .build();
        when(quizRepository.findById(7L)).thenReturn(Optional.of(quiz));
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        when(attemptRepository.save(any(QuizAttempt.class))).thenAnswer(inv -> inv.getArgument(0));
        when(attemptRepository.findForLeaderboard(eq(7L), any())).thenReturn(List.of());
        // Horodatage de départ posé par play il y a ~5 s : la déclaration client (1 ms) est ignorée.
        when(valueOps.get("quiz:play-start:7:1"))
                .thenReturn(String.valueOf(System.currentTimeMillis() - 5000));

        AttemptResultResponse res = service.submit(1L, 7L,
                new SubmitAttemptRequest(List.of("0"), 1));

        assertThat(res.durationMs()).isBetween(4500L, 60_000L);
    }

    @Test
    void shouldArmServerTimerOnPlay() {
        Quiz quiz = Quiz.builder().id(7L).owner(testUser(1L)).published(true)
                .questions(List.of(mcqJson("Q1", 0, "a", "b"))).build();
        when(quizRepository.findById(7L)).thenReturn(Optional.of(quiz));

        service.play(7L, 1L, false);

        verify(valueOps).set(eq("quiz:play-start:7:1"), anyString(), any(java.time.Duration.class));
    }

    @Test
    void shouldReturnExplanationsInResults() {
        Quiz quiz = Quiz.builder().id(7L).questionCount(1)
                .questions(List.of(new QuizQuestionJson("mcq", "Q1", List.of("a", "b"), 0, "",
                        null, null, null, "Parce que a.")))
                .build();
        when(quizRepository.findById(7L)).thenReturn(Optional.of(quiz));
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));
        when(attemptRepository.save(any(QuizAttempt.class))).thenAnswer(inv -> inv.getArgument(0));
        when(attemptRepository.findForLeaderboard(eq(7L), any())).thenReturn(List.of());

        AttemptResultResponse res = service.submit(1L, 7L,
                new SubmitAttemptRequest(List.of("0"), 1000));

        assertThat(res.explanations()).containsExactly("Parce que a.");
    }

    @Test
    void shouldGradeOpenAnswerNormalised() {
        Quiz quiz = Quiz.builder().id(7L).questionCount(2)
                .questions(List.of(
                        new QuizQuestionJson("open", "2+2 ?", List.of(), -1, "4", null, null, null, null),
                        new QuizQuestionJson("open", "Capitale ?", List.of(), -1, "Bruxelles", null, null, null, null)))
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
    void shouldHidePrivateQuizFromNonOwner() {
        Quiz quiz = Quiz.builder().id(7L).owner(testUser(2L)).published(false)
                .questions(List.of(mcqJson("Q1", 0, "a", "b"))).build();
        when(quizRepository.findById(7L)).thenReturn(Optional.of(quiz));

        // 404 (pas 403) : un contenu privé ne révèle pas son existence.
        assertThatThrownBy(() -> service.play(7L, 1L, false))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.full(7L, 1L, false))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.leaderboard(7L, 10, 1L, false))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void shouldLetOwnerPlayOwnPrivateQuizAndExposeAnswersInFull() {
        Quiz quiz = Quiz.builder().id(7L).owner(testUser(1L)).published(false)
                .questions(List.of(mcqJson("Q1", 1, "a", "b"))).build();
        when(quizRepository.findById(7L)).thenReturn(Optional.of(quiz));

        assertThat(service.play(7L, 1L, false).questions()).hasSize(1);
        assertThat(service.full(7L, 1L, false).questions().get(0).answer()).isEqualTo(1);
        assertThat(service.full(7L, 1L, false).owned()).isTrue();
    }

    @Test
    void shouldForbidUpdatingSomeoneElsesQuiz() {
        Quiz quiz = Quiz.builder().id(7L).owner(testUser(2L)).build();
        when(quizRepository.findById(7L)).thenReturn(Optional.of(quiz));

        assertThatThrownBy(() -> service.update(1L, false, 7L,
                request("X", null, List.of(mcq("Q", 0, "A", "B")))))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void shouldUpdateOwnQuizIncludingPublishedFlag() {
        Quiz quiz = Quiz.builder().id(7L).owner(testUser(1L)).published(false)
                .questions(List.of(mcqJson("Old", 0, "a", "b"))).questionCount(1).build();
        when(quizRepository.findById(7L)).thenReturn(Optional.of(quiz));
        when(quizRepository.save(any(Quiz.class))).thenAnswer(inv -> inv.getArgument(0));

        QuizSummary res = service.update(1L, false, 7L,
                new CreateQuizRequest("Nouveau", null, null, null,
                        List.of(mcq("Q1", 0, "A", "B"), mcq("Q2", 1, "A", "B")), true));

        assertThat(res.title()).isEqualTo("Nouveau");
        assertThat(res.questionCount()).isEqualTo(2);
        assertThat(res.published()).isTrue();
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

        List<QuizLeaderboardEntry> board = service.leaderboard(7L, 10, 99L, false);

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

    @Test
    void reportQuestion_notifies_the_author_with_the_question_number() {
        Quiz quiz = Quiz.builder().id(7L).title("Réseaux").owner(testUser(2L))
                .published(true).questionCount(5).build();
        when(quizRepository.findById(7L)).thenReturn(Optional.of(quiz));
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser(1L)));

        service.reportQuestion(1L, 7L,
                new be.freenote.dto.request.ReportQuizQuestionRequest(2, "faute dans le choix B"));

        verify(notificationService).push(eq(2L), eq("quiz.questionReported"), argThat(payload ->
                payload.get("question").equals(3) && payload.get("title").equals("Réseaux")
                        && payload.get("by").equals("user1")));
    }

    @Test
    void reportQuestion_is_silent_for_self_reports_and_rejects_bad_indexes() {
        Quiz quiz = Quiz.builder().id(7L).title("Réseaux").owner(testUser(1L))
                .published(true).questionCount(5).build();
        when(quizRepository.findById(7L)).thenReturn(Optional.of(quiz));

        // Auto-signalement : pas d'erreur, pas de notification
        service.reportQuestion(1L, 7L, new be.freenote.dto.request.ReportQuizQuestionRequest(0, null));
        verify(notificationService, never()).push(any(), any(), any());

        // Index hors bornes : 400
        assertThatThrownBy(() -> service.reportQuestion(1L, 7L,
                new be.freenote.dto.request.ReportQuizQuestionRequest(5, null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ---- dépublication (modération V18) ----

    @Test
    void unpublish_flips_the_flag_and_notifies_the_owner() {
        Quiz quiz = Quiz.builder().id(7L).title("Réseaux").owner(testUser(2L)).published(true).build();
        when(quizRepository.findById(7L)).thenReturn(Optional.of(quiz));
        when(quizRepository.save(any(Quiz.class))).thenAnswer(i -> i.getArgument(0));

        service.unpublish(7L);

        assertThat(quiz.isPublished()).isFalse();
        verify(notificationService).push(eq(2L), eq("revision.unpublished"), argThat(payload ->
                payload.get("kind").equals("quiz") && payload.get("title").equals("Réseaux")));
    }

    @Test
    void unpublish_is_idempotent_and_silent_on_an_already_private_or_orphan_quiz() {
        // Déjà privé : re-cliquer ne re-notifie pas
        Quiz privateQuiz = Quiz.builder().id(7L).title("T").owner(testUser(2L)).published(false).build();
        when(quizRepository.findById(7L)).thenReturn(Optional.of(privateQuiz));
        service.unpublish(7L);
        verify(notificationService, never()).push(any(), any(), any());
        verify(quizRepository, never()).save(any());

        // Orphelin (auteur supprimé) : dépublié sans notification, sans NPE
        Quiz orphan = Quiz.builder().id(8L).title("T").owner(null).published(true).build();
        when(quizRepository.findById(8L)).thenReturn(Optional.of(orphan));
        when(quizRepository.save(any(Quiz.class))).thenAnswer(i -> i.getArgument(0));
        service.unpublish(8L);
        assertThat(orphan.isPublished()).isFalse();
        verify(notificationService, never()).push(any(), any(), any());
    }
}
