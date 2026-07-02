-- ================================================================
-- V5 — GANTT_CHARTS : projets/diagrammes de Gantt sauvegardés & partagés
-- ================================================================
-- Migration ADDITIVE (après V1 baseline + V2 flashcards + V3 quizzes + V4 guides).
-- Un seul CREATE TABLE, aucune table existante touchée.
--
-- L'outil Gantt (/outils/gantt) est public : tout le monde construit + exporte
-- (JSON/CSV/PNG) 100 % côté client. Un étudiant VÉRIFIÉ peut en plus SAUVEGARDER
-- son projet sur son compte (shared=false) et le PARTAGER (shared=true) à la
-- bibliothèque des autres étudiants vérifiés. `tasks` = tableau JSON
-- [{id,name,start,end,progress,dependencies}] en JSONB (jamais requêté tâche par
-- tâche → pas de table fille, même pattern que quizzes/flashcard_decks).
--
-- owner_id ON DELETE SET NULL : un projet partagé survit à la suppression de son
-- auteur (il devient « Anonyme », cohérent avec documents/quizzes/decks/guides).
CREATE TABLE gantt_charts (
    id          BIGSERIAL    PRIMARY KEY,
    title       VARCHAR(100) NOT NULL,
    tasks       JSONB        NOT NULL DEFAULT '[]'::jsonb,
    task_count  INTEGER      NOT NULL DEFAULT 0,
    shared      BOOLEAN      NOT NULL DEFAULT FALSE,
    owner_id    BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Bibliothèque partagée : filtre shared puis tri du plus récemment modifié.
CREATE INDEX idx_gantt_shared ON gantt_charts(shared, updated_at DESC);
CREATE INDEX idx_gantt_owner  ON gantt_charts(owner_id);
