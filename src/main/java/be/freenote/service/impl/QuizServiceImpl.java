package be.freenote.service.impl;

import be.freenote.dto.request.CreateQuizRequest;
import be.freenote.dto.request.QuizQuestionDto;
import be.freenote.dto.request.SubmitAttemptRequest;
import be.freenote.dto.response.AttemptResultResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.dto.response.QuizLeaderboardEntry;
import be.freenote.dto.response.QuizPlayResponse;
import be.freenote.dto.response.QuizSummary;
import be.freenote.entity.Course;
import be.freenote.entity.Quiz;
import be.freenote.entity.QuizAttempt;
import be.freenote.entity.QuizQuestionJson;
import be.freenote.entity.User;
import be.freenote.exception.ForbiddenException;
import be.freenote.mapper.QuizMapper;
import be.freenote.mapper.UserMapper;
import be.freenote.repository.CourseRepository;
import be.freenote.repository.QuizAttemptRepository;
import be.freenote.repository.QuizRepository;
import be.freenote.repository.Repositories;
import be.freenote.repository.UserRepository;
import be.freenote.service.QuizService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class QuizServiceImpl implements QuizService {

    /** Hard cap on leaderboard rows returned to a caller. */
    private static final int MAX_LEADERBOARD = 100;
    /** Generous school-scale bound on the attempt scan feeding the best-per-user de-dup. */
    private static final int SCAN_BOUND = 1000;

    private final QuizRepository quizRepository;
    private final QuizAttemptRepository attemptRepository;
    private final UserRepository userRepository;
    private final CourseRepository courseRepository;

    @Override
    @Transactional
    public QuizSummary create(Long userId, CreateQuizRequest request) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        Course course = request.courseId() == null
                ? null
                : Repositories.findByIdOrThrow(courseRepository, request.courseId(), "Course");

        List<QuizQuestionJson> questions = new ArrayList<>(request.questions().size());
        for (QuizQuestionDto dto : request.questions()) {
            questions.add(buildQuestion(dto));
        }

        Quiz quiz = Quiz.builder()
                .title(request.title().trim())
                .description(request.description() == null ? null : request.description().trim())
                .questions(questions)
                .questionCount(questions.size())
                .owner(user)
                .course(course)
                .build();

        return QuizMapper.toSummary(quizRepository.save(quiz));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<QuizSummary> list(Long courseId, Pageable pageable) {
        Page<Quiz> page = courseId == null
                ? quizRepository.findAllForListing(pageable)
                : quizRepository.findByCourseForListing(courseId, pageable);
        return PageResponse.from(page, page.getContent().stream().map(QuizMapper::toSummary).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public QuizPlayResponse play(Long id) {
        return QuizMapper.toPlay(Repositories.findByIdOrThrow(quizRepository, id, "Quiz"));
    }

    @Override
    @Transactional
    public AttemptResultResponse submit(Long userId, Long quizId, SubmitAttemptRequest request) {
        Quiz quiz = Repositories.findByIdOrThrow(quizRepository, quizId, "Quiz");
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");

        List<QuizQuestionJson> questions = quiz.getQuestions();
        List<String> answers = request.answers();
        int total = questions.size();
        List<Boolean> correct = new ArrayList<>(total);
        List<String> correctAnswers = new ArrayList<>(total);
        int score = 0;
        for (int i = 0; i < total; i++) {
            QuizQuestionJson q = questions.get(i);
            String given = i < answers.size() ? answers.get(i) : null;
            boolean ok;
            String display;
            if ("open".equals(q.type())) {
                display = q.openAnswer() == null ? "" : q.openAnswer();
                ok = given != null && normalize(given).equals(normalize(display));
            } else {
                int idx = q.answer();
                display = idx >= 0 && idx < q.choices().size() ? q.choices().get(idx) : "";
                Integer chosen = parseIndex(given);
                ok = chosen != null && chosen == idx;
            }
            if (ok) {
                score++;
            }
            correct.add(ok);
            correctAnswers.add(display);
        }
        long duration = Math.max(0, request.durationMs());

        attemptRepository.save(QuizAttempt.builder()
                .quiz(quiz).user(user).score(score).total(total).durationMs(duration).build());
        quizRepository.incrementAttemptCount(quizId); // atomic, concurrency-safe

        int rank = rankOf(quizId, userId);
        return new AttemptResultResponse(score, total, duration, correct, correctAnswers, rank);
    }

    @Override
    @Transactional(readOnly = true)
    public List<QuizLeaderboardEntry> leaderboard(Long quizId, int size) {
        Repositories.findByIdOrThrow(quizRepository, quizId, "Quiz"); // 404 if the quiz is gone
        int limit = Math.min(Math.max(1, size), MAX_LEADERBOARD);
        List<QuizAttempt> best = bestPerUser(quizId);
        List<QuizLeaderboardEntry> entries = new ArrayList<>(Math.min(limit, best.size()));
        for (int i = 0; i < best.size() && i < limit; i++) {
            QuizAttempt a = best.get(i);
            User u = a.getUser();
            entries.add(new QuizLeaderboardEntry(
                    i + 1, u.getId(), UserMapper.resolveDisplayName(u.getProfile(), u.getUsername()),
                    a.getScore(), a.getTotal(), a.getDurationMs(), a.getCreatedAt()));
        }
        return entries;
    }

    @Override
    @Transactional
    public void delete(Long userId, boolean isAdmin, Long id) {
        Quiz quiz = Repositories.findByIdOrThrow(quizRepository, id, "Quiz");
        boolean isOwner = quiz.getOwner() != null && quiz.getOwner().getId().equals(userId);
        if (!isAdmin && !isOwner) {
            throw new ForbiddenException("Vous ne pouvez supprimer que vos propres quiz.");
        }
        quizRepository.delete(quiz);
    }

    /** Attempts ordered best-first, de-duplicated to the single best attempt per user. */
    private List<QuizAttempt> bestPerUser(Long quizId) {
        List<QuizAttempt> all = attemptRepository.findForLeaderboard(quizId, PageRequest.of(0, SCAN_BOUND));
        Set<Long> seen = new HashSet<>();
        List<QuizAttempt> best = new ArrayList<>();
        for (QuizAttempt a : all) {
            if (seen.add(a.getUser().getId())) {
                best.add(a);
            }
        }
        return best;
    }

    /** 1-based rank of the user's best attempt on the leaderboard, or 0 if absent. */
    private int rankOf(Long quizId, Long userId) {
        List<QuizAttempt> best = bestPerUser(quizId);
        for (int i = 0; i < best.size(); i++) {
            if (best.get(i).getUser().getId().equals(userId)) {
                return i + 1;
            }
        }
        return 0;
    }

    /** Validate + normalise one question DTO into its stored JSONB form (per {@code type}). */
    private QuizQuestionJson buildQuestion(QuizQuestionDto dto) {
        String question = dto.question().trim();
        String image = blankToNull(dto.image());
        String code = blankToNull(dto.code());
        String language = blankToNull(dto.language());

        if ("open".equalsIgnoreCase(dto.type())) {
            String open = dto.openAnswer() == null ? "" : dto.openAnswer().trim();
            if (open.isBlank()) {
                throw new IllegalArgumentException("Réponse attendue manquante pour une question ouverte.");
            }
            return new QuizQuestionJson("open", question, List.of(), -1, open, image, code, language);
        }

        List<String> choices = (dto.choices() == null ? List.<String>of() : dto.choices())
                .stream().map(c -> c == null ? "" : c.trim()).toList();
        if (choices.size() < 2 || choices.stream().anyMatch(String::isBlank)) {
            throw new IllegalArgumentException("Un QCM exige au moins deux réponses non vides.");
        }
        if (dto.answer() < 0 || dto.answer() >= choices.size()) {
            throw new IllegalArgumentException("Index de bonne réponse invalide.");
        }
        return new QuizQuestionJson("mcq", question, choices, dto.answer(), "", image, code, language);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    /** Case/space-insensitive comparison key for open answers. */
    private static String normalize(String s) {
        return s == null ? "" : s.trim().toLowerCase().replaceAll("\\s+", " ");
    }

    /** Parse a chosen MCQ index sent as a string, or null if it isn't an integer. */
    private static Integer parseIndex(String s) {
        if (s == null) {
            return null;
        }
        try {
            return Integer.parseInt(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
