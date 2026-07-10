package be.freenote.service.impl;

import be.freenote.dto.request.CreateQuizRequest;
import be.freenote.dto.request.QuizQuestionDto;
import be.freenote.dto.request.SubmitAttemptRequest;
import be.freenote.dto.response.AttemptResultResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.dto.response.QuizFullResponse;
import be.freenote.dto.response.QuizLeaderboardEntry;
import be.freenote.dto.response.QuizListRow;
import be.freenote.dto.response.QuizPlayResponse;
import be.freenote.dto.response.QuizSummary;
import be.freenote.entity.Course;
import be.freenote.entity.Quiz;
import be.freenote.entity.QuizAttempt;
import be.freenote.entity.QuizQuestionJson;
import be.freenote.entity.Section;
import be.freenote.entity.User;
import be.freenote.exception.ForbiddenException;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.mapper.QuizMapper;
import be.freenote.mapper.UserMapper;
import be.freenote.repository.CourseRepository;
import be.freenote.repository.QuizAttemptRepository;
import be.freenote.repository.QuizRepository;
import be.freenote.repository.Repositories;
import be.freenote.repository.SectionRepository;
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
    /** Poids total maximal d'un quiz (somme des textes/images/code de toutes les questions).
     *  Les bornes par champ (image 300 Ko × 100 questions) autoriseraient sinon un JSONB de 30 Mo. */
    private static final int MAX_TOTAL_CONTENT_CHARS = 2_000_000;
    /** Durée d'essai plafonnée à 3 h — au-delà, l'essai est enregistré à 3 h pile. */
    private static final long MAX_DURATION_MS = 3L * 3600 * 1000;
    /** Préfixe Redis de l'horodatage de départ posé par {@code play} (anti-triche classement). */
    private static final String PLAY_START_PREFIX = "quiz:play-start:";

    private final QuizRepository quizRepository;
    private final QuizAttemptRepository attemptRepository;
    private final UserRepository userRepository;
    private final CourseRepository courseRepository;
    private final SectionRepository sectionRepository;
    private final be.freenote.service.CourseEquivalenceService courseEquivalenceService;
    private final be.freenote.service.NotificationService notificationService;
    private final be.freenote.service.TrackingService trackingService;
    private final org.springframework.data.redis.core.StringRedisTemplate redisTemplate;

    @Override
    @Transactional
    public QuizSummary create(Long userId, CreateQuizRequest request) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        Course course = request.courseId() == null
                ? null
                : Repositories.findByIdOrThrow(courseRepository, request.courseId(), "Course");

        List<QuizQuestionJson> questions = buildQuestions(request.questions());

        Quiz quiz = Quiz.builder()
                .title(request.title().trim())
                .description(request.description() == null ? null : request.description().trim())
                .questions(questions)
                .questionCount(questions.size())
                .published(Boolean.TRUE.equals(request.published()))
                .owner(user)
                .course(course)
                .section(resolveSection(course, request.sectionId()))
                .build();

        return QuizMapper.toSummary(quizRepository.save(quiz), userId);
    }

    @Override
    @Transactional
    public QuizSummary update(Long userId, boolean isAdmin, Long id, CreateQuizRequest request) {
        Quiz quiz = Repositories.findByIdOrThrow(quizRepository, id, "Quiz");
        if (!isOwner(quiz, userId) && !isAdmin) {
            throw new ForbiddenException("Vous ne pouvez modifier que vos propres quiz.");
        }
        Course course = request.courseId() == null
                ? null
                : Repositories.findByIdOrThrow(courseRepository, request.courseId(), "Course");
        List<QuizQuestionJson> questions = buildQuestions(request.questions());

        quiz.setTitle(request.title().trim());
        quiz.setDescription(request.description() == null ? null : request.description().trim());
        quiz.setQuestions(questions);
        quiz.setQuestionCount(questions.size());
        quiz.setCourse(course);
        quiz.setSection(resolveSection(course, request.sectionId()));
        quiz.setPublished(Boolean.TRUE.equals(request.published()));
        return QuizMapper.toSummary(quizRepository.save(quiz), userId);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<QuizSummary> list(Long courseId, Long sectionId, Long ownerId, Pageable pageable, Long callerId) {
        // Équivalences (V15) : les quiz de « Stats (Compta) » remontent aussi pour « Stats (Info) »
        Page<QuizListRow> page = quizRepository.findPublishedRows(
                courseEquivalenceService.expand(courseId), sectionId, ownerId, pageable);
        return PageResponse.from(page, page.getContent().stream().map(r -> QuizMapper.toSummary(r, callerId)).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<QuizSummary> mine(Long userId, Pageable pageable) {
        Page<QuizListRow> page = quizRepository.findMineRows(userId, pageable);
        return PageResponse.from(page, page.getContent().stream().map(r -> QuizMapper.toSummary(r, userId)).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public QuizPlayResponse play(Long id, Long callerId, boolean isAdmin) {
        Quiz quiz = accessibleQuiz(id, callerId, isAdmin);
        if (callerId != null) {
            // Le chrono du classement démarre ICI, côté serveur : le client ne peut plus prétendre
            // un temps d'une seconde. TTL = plafond + marge, un nouveau play réarme le départ.
            redisTemplate.opsForValue().set(
                    playKey(id, callerId),
                    String.valueOf(System.currentTimeMillis()),
                    java.time.Duration.ofMillis(MAX_DURATION_MS + 600_000));
        }
        return QuizMapper.toPlay(quiz);
    }

    @Override
    @Transactional(readOnly = true)
    public QuizFullResponse full(Long id, Long callerId, boolean isAdmin) {
        // Publié : n'importe quel vérifié peut l'importer (réponses incluses — inhérent au modèle
        // « importer et modifier »). Privé : propriétaire/admin uniquement.
        return QuizMapper.toFull(accessibleQuiz(id, callerId, isAdmin), callerId);
    }

    @Override
    @Transactional
    public AttemptResultResponse submit(Long userId, Long quizId, SubmitAttemptRequest request) {
        Quiz quiz = accessibleQuiz(quizId, userId, false);
        // Joueur anonyme (révision publique) : la partie est corrigée serveur comme les autres,
        // mais AUCUN essai n'est persisté — hors classement par construction, rang 0.
        User user = userId == null ? null : Repositories.findByIdOrThrow(userRepository, userId, "User");

        List<QuizQuestionJson> questions = quiz.getQuestions();
        List<String> answers = request.answers();
        int total = questions.size();
        List<Boolean> correct = new ArrayList<>(total);
        List<String> correctAnswers = new ArrayList<>(total);
        List<String> explanations = new ArrayList<>(total);
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
            explanations.add(q.explanation());
        }
        // Anonyme : pas d'horodatage Redis posé par play() → durée client bornée, sans plus
        // (aucun enjeu anti-triche hors classement).
        long duration = user == null
                ? Math.min(Math.max(0, request.durationMs()), MAX_DURATION_MS)
                : resolveDuration(quizId, userId, request.durationMs());

        if (user != null) {
            attemptRepository.save(QuizAttempt.builder()
                    .quiz(quiz).user(user).score(score).total(total).durationMs(duration).build());
        }
        quizRepository.incrementAttemptCount(quizId); // atomic, concurrency-safe
        // Série journalière « parties de quiz » (panel admin) — l'attemptCount par quiz est cumulatif.
        trackingService.increment(be.freenote.service.TrackingService.METRIC_QUIZ_PLAY, "");

        int rank = user == null ? 0 : rankOf(quizId, userId);
        return new AttemptResultResponse(score, total, duration, correct, correctAnswers, explanations, rank);
    }

    @Override
    @Transactional(readOnly = true)
    public List<QuizLeaderboardEntry> leaderboard(Long quizId, int size, Long callerId, boolean isAdmin) {
        accessibleQuiz(quizId, callerId, isAdmin); // 404 si le quiz est privé/inexistant
        int limit = Math.min(Math.max(1, size), MAX_LEADERBOARD);
        List<QuizAttempt> best = bestPerUser(quizId);
        List<QuizLeaderboardEntry> entries = new ArrayList<>(Math.min(limit, best.size()));
        for (int i = 0; i < best.size() && i < limit; i++) {
            QuizAttempt a = best.get(i);
            User u = a.getUser();
            entries.add(new QuizLeaderboardEntry(
                    i + 1, u.getId(), UserMapper.resolveDisplayName(u.getProfile(), u.getUsername()),
                    u.getUsername(),
                    UserMapper.resolveAvatarUrl(u.getProfile(), u.getUsername()),
                    a.getScore(), a.getTotal(), a.getDurationMs(), a.getCreatedAt()));
        }
        return entries;
    }

    @Override
    @Transactional
    public void delete(Long userId, boolean isAdmin, Long id) {
        Quiz quiz = Repositories.findByIdOrThrow(quizRepository, id, "Quiz");
        if (!isAdmin && !isOwner(quiz, userId)) {
            throw new ForbiddenException("Vous ne pouvez supprimer que vos propres quiz.");
        }
        quizRepository.delete(quiz);
    }

    @Override
    @Transactional
    public void unpublish(Long id) {
        Quiz quiz = Repositories.findByIdOrThrow(quizRepository, id, "Quiz");
        if (!quiz.isPublished()) {
            return; // déjà privé : re-cliquer ne doit ni échouer ni re-notifier
        }
        quiz.setPublished(false);
        quizRepository.save(quiz);
        // Le quiz ne disparaît pas : il redevient un enregistrement privé — prévenir l'auteur pour
        // qu'il ne croie pas à une perte de données (clé i18n notifications.revision.unpublished).
        User owner = quiz.getOwner();
        if (owner != null) {
            notificationService.push(owner.getId(), "revision.unpublished", java.util.Map.of(
                    "kind", "quiz",
                    "title", quiz.getTitle()));
        }
    }

    @Override
    @Transactional
    public void reportQuestion(Long reporterId, Long quizId, be.freenote.dto.request.ReportQuizQuestionRequest request) {
        Quiz quiz = Repositories.findByIdOrThrow(quizRepository, quizId, "Quiz");
        if (!quiz.isPublished()) {
            // Même règle 404 que accessibleQuiz : ne pas révéler l'existence d'un quiz privé.
            throw new ResourceNotFoundException("Quiz", "id", quizId);
        }
        if (request.questionIndex() >= quiz.getQuestionCount()) {
            throw new IllegalArgumentException("Index de question invalide");
        }
        User owner = quiz.getOwner();
        if (owner == null || owner.getId().equals(reporterId)) {
            return; // quiz orphelin ou auto-signalement : personne à prévenir, mais pas une erreur
        }
        User reporter = Repositories.findByIdOrThrow(userRepository, reporterId, "User");
        String message = request.message() == null ? "" : request.message().trim();
        // La notification porte l'essentiel (titre + n° de question + qui) — payload rendu par
        // la cloche via i18n `notifications.quiz.questionReported`.
        notificationService.push(owner.getId(), "quiz.questionReported", java.util.Map.of(
                "quizId", quiz.getId(),
                "title", quiz.getTitle(),
                "question", request.questionIndex() + 1,
                "by", reporter.getUsername(),
                "message", message));
    }

    /** Le quiz s'il est accessible à l'appelant : publié, ou possédé, ou admin — sinon 404
     *  (jamais 403 : ne pas révéler l'existence d'un contenu privé, même pattern que les Gantt). */
    private Quiz accessibleQuiz(Long id, Long callerId, boolean isAdmin) {
        Quiz quiz = Repositories.findByIdOrThrow(quizRepository, id, "Quiz");
        if (!quiz.isPublished() && !isOwner(quiz, callerId) && !isAdmin) {
            throw new ResourceNotFoundException("Quiz", "id", id);
        }
        return quiz;
    }

    private static boolean isOwner(Quiz quiz, Long userId) {
        return quiz.getOwner() != null && quiz.getOwner().getId().equals(userId);
    }

    /** Règle de cohérence V13 : un cours choisi impose SA section (jamais un quiz « cours X »
     *  rangé dans une autre section) ; sans cours, la section libre — nullable — permet le
     *  quiz multi-cours « toute la section ». */
    private Section resolveSection(Course course, Long sectionId) {
        if (course != null) {
            return course.getSection();
        }
        return sectionId == null ? null : Repositories.findByIdOrThrow(sectionRepository, sectionId, "Section");
    }

    private static String playKey(Long quizId, Long userId) {
        return PLAY_START_PREFIX + quizId + ":" + userId;
    }

    /** Durée d'essai : mesurée SERVEUR entre le dernier {@code play} et le submit (la valeur du
     *  client ne sert que de repli si l'horodatage Redis a disparu — flush, TTL 3 h dépassé).
     *  Toujours plafonnée à {@link #MAX_DURATION_MS}. */
    private long resolveDuration(Long quizId, Long userId, long claimedMs) {
        long duration = claimedMs;
        try {
            String started = redisTemplate.opsForValue().get(playKey(quizId, userId));
            if (started != null) {
                duration = System.currentTimeMillis() - Long.parseLong(started);
            }
        } catch (NumberFormatException e) {
            // Valeur corrompue : on retombe sur la déclaration client bornée.
        }
        return Math.min(Math.max(0, duration), MAX_DURATION_MS);
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

    /** Validation + normalisation des questions, avec borne sur le POIDS TOTAL du quiz. */
    private List<QuizQuestionJson> buildQuestions(List<QuizQuestionDto> dtos) {
        List<QuizQuestionJson> questions = new ArrayList<>(dtos.size());
        long totalChars = 0;
        for (QuizQuestionDto dto : dtos) {
            QuizQuestionJson q = buildQuestion(dto);
            totalChars += q.question().length()
                    + (q.image() == null ? 0 : q.image().length())
                    + (q.code() == null ? 0 : q.code().length())
                    + (q.openAnswer() == null ? 0 : q.openAnswer().length())
                    + (q.explanation() == null ? 0 : q.explanation().length())
                    + q.choices().stream().mapToInt(String::length).sum();
            if (totalChars > MAX_TOTAL_CONTENT_CHARS) {
                throw new IllegalArgumentException("Quiz trop volumineux (2 Mo max de contenu, images comprises).");
            }
            questions.add(q);
        }
        return questions;
    }

    /** Validate + normalise one question DTO into its stored JSONB form (per {@code type}). */
    private QuizQuestionJson buildQuestion(QuizQuestionDto dto) {
        String question = dto.question().trim();
        String image = blankToNull(dto.image());
        // Une image doit être un data URI embarqué — jamais une URL externe (pas de pixel de
        // tracking / dépendance tierce ; la CSP img-src la bloquerait de toute façon au rendu).
        if (image != null && !image.startsWith("data:image/")) {
            throw new IllegalArgumentException("Image invalide (data URI attendu).");
        }
        String code = blankToNull(dto.code());
        String language = blankToNull(dto.language());
        String explanation = blankToNull(dto.explanation());

        if ("open".equalsIgnoreCase(dto.type())) {
            String open = dto.openAnswer() == null ? "" : dto.openAnswer().trim();
            if (open.isBlank()) {
                throw new IllegalArgumentException("Réponse attendue manquante pour une question ouverte.");
            }
            return new QuizQuestionJson("open", question, List.of(), -1, open, image, code, language, explanation);
        }

        List<String> choices = (dto.choices() == null ? List.<String>of() : dto.choices())
                .stream().map(c -> c == null ? "" : c.trim()).toList();
        if (choices.size() < 2 || choices.stream().anyMatch(String::isBlank)) {
            throw new IllegalArgumentException("Un QCM exige au moins deux réponses non vides.");
        }
        int answer = dto.answer() == null ? -1 : dto.answer();
        if (answer < 0 || answer >= choices.size()) {
            throw new IllegalArgumentException("Index de bonne réponse invalide.");
        }
        return new QuizQuestionJson("mcq", question, choices, answer, "", image, code, language, explanation);
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
