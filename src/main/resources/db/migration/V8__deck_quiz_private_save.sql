-- ================================================================
-- V8 — DECKS + QUIZ : sauvegarde privée côté serveur (published) + updated_at
-- ================================================================
-- Migration ADDITIVE (après V1..V7 ; V1 déployée en prod est intouchée, ces ALTER
-- ne touchent que les tables V2/V3 créées au même déploiement — aucune donnée modifiée).
--
-- Nouveau modèle (2026-07-02) : un utilisateur vérifié peut désormais ENREGISTRER un
-- paquet/quiz sur son compte SANS le publier (published = false → visible de lui seul,
-- comme les projets Gantt privés). published = true = visible dans la bibliothèque.
-- DEFAULT TRUE : les lignes existantes étaient toutes des publications — sémantique conservée.
ALTER TABLE flashcard_decks ADD COLUMN published  BOOLEAN   NOT NULL DEFAULT TRUE;
ALTER TABLE flashcard_decks ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE quizzes         ADD COLUMN published  BOOLEAN   NOT NULL DEFAULT TRUE;
ALTER TABLE quizzes         ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT NOW();

-- Bibliothèque (published, plus récent d'abord) et « Mes X » (par propriétaire, dernier modifié d'abord).
CREATE INDEX idx_flashcard_decks_published     ON flashcard_decks(published, created_at DESC);
CREATE INDEX idx_quizzes_published             ON quizzes(published, created_at DESC);
CREATE INDEX idx_flashcard_decks_owner_updated ON flashcard_decks(owner_id, updated_at DESC);
CREATE INDEX idx_quizzes_owner_updated         ON quizzes(owner_id, updated_at DESC);
