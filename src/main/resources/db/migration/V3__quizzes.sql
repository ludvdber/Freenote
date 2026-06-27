-- ================================================================
-- V3 — QUIZZES + QUIZ_ATTEMPTS : quiz partageables + classement
-- ================================================================
-- Migration ADDITIVE (après V1 baseline déployée + V2 flashcards). Deux
-- nouveaux CREATE TABLE, aucune table existante n'est touchée.
--
-- Modèle d'accès (décidé 2026-06-18) : tout le backend quiz est réservé aux
-- étudiants ISFCE vérifiés (règle globale anyRequest().hasRole("VERIFIED")).
-- Les anonymes jouent un quiz ÉPHÉMÈRE encodé dans l'URL, 100 % côté client,
-- donc sans toucher ces tables (ni stockage ni modération publique).
--
-- questions : tableau JSON [{question, choices[], answer}] en JSONB (jamais
-- requêté question par question → pas de table fille). `answer` est l'index
-- 0-based de la bonne réponse ; il n'est JAMAIS renvoyé à un joueur (le serveur
-- corrige) pour empêcher la triche par inspection réseau.
--
-- owner_id ON DELETE SET NULL : supprimer un compte ne détruit pas le quiz
-- partagé (cohérent avec documents/flashcard_decks) — il devient « Anonyme ».
-- course_id ON DELETE SET NULL : si le cours disparaît, le quiz survit détaché.
CREATE TABLE quizzes (
    id              BIGSERIAL    PRIMARY KEY,
    title           VARCHAR(100) NOT NULL,
    description     VARCHAR(500),
    questions       JSONB        NOT NULL DEFAULT '[]'::jsonb,
    question_count  INTEGER      NOT NULL DEFAULT 0,
    attempt_count   INTEGER      NOT NULL DEFAULT 0,
    owner_id        BIGINT       REFERENCES users(id)   ON DELETE SET NULL,
    course_id       BIGINT       REFERENCES courses(id) ON DELETE SET NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quizzes_created ON quizzes(created_at DESC);
CREATE INDEX idx_quizzes_course  ON quizzes(course_id);
CREATE INDEX idx_quizzes_owner   ON quizzes(owner_id);

-- Un essai = un score personnel, PAS du contenu partagé : ON DELETE CASCADE
-- sur user_id ET quiz_id. Supprimer/bannir un compte purge ses scores (aucun
-- fantôme au classement) ; supprimer un quiz emporte ses essais.
-- Le classement garde le MEILLEUR essai par utilisateur (score DESC, durée ASC).
CREATE TABLE quiz_attempts (
    id              BIGSERIAL PRIMARY KEY,
    quiz_id         BIGINT    NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    user_id         BIGINT    NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    score           INTEGER   NOT NULL,
    total           INTEGER   NOT NULL,
    duration_ms     BIGINT    NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);
-- Tri du classement (meilleur essai par user) appuyé par cet index composite.
CREATE INDEX idx_quiz_attempts_leaderboard ON quiz_attempts(quiz_id, score DESC, duration_ms ASC);
