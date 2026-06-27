-- ================================================================
-- V2 — FLASHCARD_DECKS : partage de paquets de cartes (palier C)
-- ================================================================
-- Première migration APRÈS la baseline V1 (déjà déployée en prod). Strictement
-- ADDITIVE : un seul CREATE TABLE, aucune table existante n'est touchée — les
-- données existantes (users, documents, …) sont intactes.
--
-- Seuls les paquets PUBLIÉS vivent ici ; les paquets privés restent en
-- localStorage côté navigateur (outil /outils/flashcards). Le contenu des cartes
-- est un tableau JSON [{front, back}] stocké en JSONB (jamais requêté carte par
-- carte → pas de table fille, pas de N+1).
--
-- owner_id ON DELETE SET NULL : supprimer un compte ne détruit pas le contenu
-- partagé (cohérent avec documents.user_id) — le paquet devient « Anonyme ».
-- course_id ON DELETE SET NULL : si le cours disparaît, le paquet survit détaché.
CREATE TABLE flashcard_decks (
    id              BIGSERIAL    PRIMARY KEY,
    title           VARCHAR(100) NOT NULL,
    description     VARCHAR(500),
    cards           JSONB        NOT NULL DEFAULT '[]'::jsonb,
    card_count      INTEGER      NOT NULL DEFAULT 0,
    owner_id        BIGINT       REFERENCES users(id)   ON DELETE SET NULL,
    course_id       BIGINT       REFERENCES courses(id) ON DELETE SET NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_flashcard_decks_created ON flashcard_decks(created_at DESC);
CREATE INDEX idx_flashcard_decks_course  ON flashcard_decks(course_id);
CREATE INDEX idx_flashcard_decks_owner   ON flashcard_decks(owner_id);
