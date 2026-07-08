-- ================================================================
-- V13 — QUIZ/PAQUETS : rattachement à une SECTION (refonte bibliothèques 2026-07-07)
-- ================================================================
-- Migration ADDITIVE (V1..V12 gelées). Un quiz/paquet peut viser une section entière
-- SANS cours précis (quiz multi-cours « toute la section ») — jusqu'ici seul course_id
-- existait, la notion de section était impossible.
--
-- Règle de cohérence (appliquée par les services) : un cours choisi impose SA section ;
-- section_id libre uniquement quand course_id est NULL. Le backfill ci-dessous aligne
-- l'existant sur cette règle (section dérivée du cours pour toutes les lignes liées).
-- ON DELETE SET NULL : la section supprimée détache le contenu, ne le supprime pas
-- (même règle que course_id en V2/V3).

ALTER TABLE quizzes         ADD COLUMN section_id BIGINT REFERENCES sections(id) ON DELETE SET NULL;
ALTER TABLE flashcard_decks ADD COLUMN section_id BIGINT REFERENCES sections(id) ON DELETE SET NULL;

UPDATE quizzes q         SET section_id = c.section_id FROM courses c WHERE q.course_id = c.id;
UPDATE flashcard_decks d SET section_id = c.section_id FROM courses c WHERE d.course_id = c.id;

CREATE INDEX idx_quizzes_section         ON quizzes(section_id);
CREATE INDEX idx_flashcard_decks_section ON flashcard_decks(section_id);
