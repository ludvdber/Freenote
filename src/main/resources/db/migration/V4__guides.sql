-- ================================================================
-- V4 — GUIDES : tutoriels/articles rédigés par l'admin (contenu public)
-- ================================================================
-- Migration ADDITIVE (après V1 baseline + V2 flashcards + V3 quizzes). Un seul
-- CREATE TABLE, aucune table existante touchée — données prod intactes.
--
-- But : des pages de contenu ORIGINAL, publiques et indexables (SEO + AdSense),
-- du type « Comment utiliser le décalage binaire en Java ». Rédigées uniquement
-- par un admin (aucune surface publique d'écriture). `content` = Markdown brut,
-- rendu + assaini côté client (marked → DOMPurify → highlight.js).
--
-- slug UNIQUE = URL stable /guides/{slug} (dérivé du titre, suffixé si collision,
-- jamais modifié ensuite → liens permanents).
-- author_id ON DELETE SET NULL + author_name snapshot : le guide survit à la
-- suppression de son auteur (cohérent avec documents/quizzes/flashcard_decks).
-- published : un brouillon (false) est invisible du public, visible seulement
-- dans le panel admin.
CREATE TABLE guides (
    id           BIGSERIAL    PRIMARY KEY,
    slug         VARCHAR(160) NOT NULL UNIQUE,
    title        VARCHAR(160) NOT NULL,
    summary      VARCHAR(300),
    content      TEXT         NOT NULL,
    category     VARCHAR(40),
    published    BOOLEAN      NOT NULL DEFAULT FALSE,
    author_id    BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    author_name  VARCHAR(60)  NOT NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Liste publique : filtre published puis tri du plus récent au plus ancien.
CREATE INDEX idx_guides_published ON guides(published, created_at DESC);
