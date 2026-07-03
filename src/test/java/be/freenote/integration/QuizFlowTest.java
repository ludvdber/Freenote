package be.freenote.integration;

import be.freenote.entity.Quiz;
import be.freenote.entity.User;
import be.freenote.repository.QuizAttemptRepository;
import be.freenote.repository.QuizRepository;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * End-to-end HTTP coverage of the quiz feature on a real Postgres (Testcontainers): JSONB round-trip,
 * server-side grading, the play view hiding answers, best-per-user leaderboard, FK cascade and the
 * verified-only access gate. Complements the Mockito unit test (which can't exercise JSONB or SQL).
 */
@Tag("integration")
class QuizFlowTest extends AbstractIntegrationTest {

    @Autowired private QuizRepository quizRepository;
    @Autowired private QuizAttemptRepository attemptRepository;

    private User verified;
    private String jwt;

    private static final String CREATE_BODY = """
            {
              "title": "Réseaux — OSI",
              "published": true,
              "questions": [
                {"question": "Couche transport ?", "choices": ["UDP", "TCP"], "answer": 1},
                {"question": "Protocole de résolution ?", "choices": ["ARP", "IP", "HTTP"], "answer": 0}
              ]
            }
            """;

    /** Sans "published" : Jackson met le boolean à false → enregistrement PRIVÉ. */
    private static final String CREATE_PRIVATE_BODY = """
            {
              "title": "Brouillon privé",
              "questions": [
                {"question": "2+2 ?", "type": "open", "openAnswer": "4", "explanation": "Addition simple."}
              ]
            }
            """;

    @BeforeEach
    void setUp() {
        attemptRepository.deleteAll();
        quizRepository.deleteAll();
        userRepository.deleteAll();
        verified = createVerifiedUser("quiz-author");
        jwt = jwtFor(verified);
    }

    private long createQuiz() throws Exception {
        String body = mockMvc.perform(post("/api/quizzes")
                        .header("Authorization", "Bearer " + jwt).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(CREATE_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.questionCount").value(2))
                .andExpect(jsonPath("$.title").value("Réseaux — OSI"))
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    @Test
    void shouldRoundTripQuestionsThroughJsonbAndHideAnswersOnPlay() throws Exception {
        long id = createQuiz();

        // JSONB persisted correctly (read straight from the DB).
        Quiz stored = quizRepository.findById(id).orElseThrow();
        assertThat(stored.getQuestions()).hasSize(2);
        assertThat(stored.getQuestions().get(0).type()).isEqualTo("mcq");
        assertThat(stored.getQuestions().get(0).choices()).containsExactly("UDP", "TCP");
        assertThat(stored.getQuestions().get(0).answer()).isEqualTo(1);

        // The play view exposes choices but NOT the answer index (anti-cheat).
        mockMvc.perform(get("/api/quizzes/{id}/play", id).header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions[0].type").value("mcq"))
                .andExpect(jsonPath("$.questions[0].choices.length()").value(2))
                .andExpect(jsonPath("$.questions[0].answer").doesNotExist())
                .andExpect(jsonPath("$.questions[1].choices[2]").value("HTTP"));
    }

    @Test
    void shouldGradeServerSideAndRankOnLeaderboard() throws Exception {
        long id = createQuiz();

        // Author scores 1/2 (Q1 right, Q2 wrong). Server grades — client sends only its choices.
        mockMvc.perform(post("/api/quizzes/{id}/attempts", id)
                        .header("Authorization", "Bearer " + jwt).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answers\":[\"1\",\"2\"],\"durationMs\":5000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.score").value(1))
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.correct[0]").value(true))
                .andExpect(jsonPath("$.correct[1]").value(false))
                .andExpect(jsonPath("$.correctAnswers[0]").value("TCP"))  // display text of the right choice
                .andExpect(jsonPath("$.correctAnswers[1]").value("ARP"))
                .andExpect(jsonPath("$.rank").value(1));

        // A second user aces it (2/2) → takes rank 1; the author drops to rank 2 (best-per-user).
        User other = createVerifiedUser("quiz-player");
        mockMvc.perform(post("/api/quizzes/{id}/attempts", id)
                        .header("Authorization", "Bearer " + jwtFor(other)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answers\":[\"1\",\"0\"],\"durationMs\":3000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.score").value(2));

        mockMvc.perform(get("/api/quizzes/{id}/leaderboard", id).header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].rank").value(1))
                .andExpect(jsonPath("$[0].userName").value("quiz-player"))
                .andExpect(jsonPath("$[0].score").value(2))
                .andExpect(jsonPath("$[1].rank").value(2))
                .andExpect(jsonPath("$[1].userName").value("quiz-author"));

        // Popularity counter bumped atomically (two submits).
        assertThat(quizRepository.findById(id).orElseThrow().getAttemptCount()).isEqualTo(2);
    }

    @Test
    void shouldCascadeDeleteAttemptsWhenQuizDeleted() throws Exception {
        long id = createQuiz();
        mockMvc.perform(post("/api/quizzes/{id}/attempts", id)
                        .header("Authorization", "Bearer " + jwt).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answers\":[\"1\",\"0\"],\"durationMs\":1000}"))
                .andExpect(status().isOk());
        assertThat(attemptRepository.count()).isEqualTo(1);

        // Owner deletes the quiz → quiz_attempts.quiz_id ON DELETE CASCADE clears the attempts.
        mockMvc.perform(delete("/api/quizzes/{id}", id)
                        .header("Authorization", "Bearer " + jwt).with(csrf()))
                .andExpect(status().isNoContent());
        assertThat(attemptRepository.count()).isZero();
    }

    @Test
    void shouldSupportPrivateSaveThenPublishLifecycle() throws Exception {
        // 1. Enregistrement privé (pas de "published" dans le JSON → false).
        String body = mockMvc.perform(post("/api/quizzes")
                        .header("Authorization", "Bearer " + jwt).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(CREATE_PRIVATE_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.published").value(false))
                .andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(body, "$.id")).longValue();

        // 2. Invisible de la bibliothèque et intouchable par un tiers (404, pas 403).
        User other = createVerifiedUser("quiz-curieux");
        String otherJwt = jwtFor(other);
        mockMvc.perform(get("/api/quizzes").header("Authorization", "Bearer " + otherJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get("/api/quizzes/{id}/play", id).header("Authorization", "Bearer " + otherJwt))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/quizzes/{id}/full", id).header("Authorization", "Bearer " + otherJwt))
                .andExpect(status().isNotFound());

        // 3. Le propriétaire le voit dans « Mes quiz » et peut l'éditer (réponses incluses).
        mockMvc.perform(get("/api/quizzes/mine").header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].owned").value(true));
        mockMvc.perform(get("/api/quizzes/{id}/full", id).header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions[0].openAnswer").value("4"))
                .andExpect(jsonPath("$.questions[0].explanation").value("Addition simple."));

        // 4. Publication via PUT → visible en bibliothèque, importable (full) par un tiers.
        mockMvc.perform(put("/api/quizzes/{id}", id)
                        .header("Authorization", "Bearer " + jwt).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREATE_PRIVATE_BODY.replace("\"questions\"", "\"published\": true, \"questions\"")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(true));
        mockMvc.perform(get("/api/quizzes").header("Authorization", "Bearer " + otherJwt))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].owned").value(false));
        mockMvc.perform(get("/api/quizzes/{id}/full", id).header("Authorization", "Bearer " + otherJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions[0].openAnswer").value("4"));

        // 5. L'explication est renvoyée dans le résultat d'un essai (écran de review).
        mockMvc.perform(post("/api/quizzes/{id}/attempts", id)
                        .header("Authorization", "Bearer " + otherJwt).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answers\":[\"4\"],\"durationMs\":1000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.score").value(1))
                .andExpect(jsonPath("$.explanations[0]").value("Addition simple."));
    }

    @Test
    void shouldRejectUnverifiedUser() throws Exception {
        long id = createQuiz();
        String unverifiedJwt = jwtFor(createUser("quiz-newbie", false, "USER"));

        mockMvc.perform(post("/api/quizzes")
                        .header("Authorization", "Bearer " + unverifiedJwt).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(CREATE_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/quizzes/{id}/play", id).header("Authorization", "Bearer " + unverifiedJwt))
                .andExpect(status().isForbidden());
    }
}
