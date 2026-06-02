-- ============================================================
-- V1 — Schéma initial consolidé
-- ============================================================
-- Reflète l'état réel attendu par les entités JPA (ddl-auto=validate).
-- Consolidation 2026-06-01 des anciennes V1..V7 (elles-mêmes issues de la fusion
-- V1..V16 du 2026-05-27) en un seul fichier, avant le premier déploiement (pas de
-- prod existante à préserver). Toute modif ULTÉRIEURE = nouveau fichier V2, V3, …
--
-- Tables ordonnées selon leurs dépendances de clés étrangères :
--   users → sections → user_profiles → user_oauth_links → professors → courses
--   → documents → tags → ratings → favorites → reports → donations
--   → delegate_history → notifications → bans

-- ----------------------------------------------------------------
-- USERS — identité technique
-- ----------------------------------------------------------------
CREATE TABLE users (
    id              BIGSERIAL    PRIMARY KEY,
    username        VARCHAR(255) NOT NULL UNIQUE,
    -- FALSE pour un compte OAuth fraîchement provisionné qui n'a pas encore choisi son pseudo.
    username_chosen BOOLEAN      NOT NULL DEFAULT TRUE,
    email_hash      VARCHAR(255) UNIQUE,
    verified        BOOLEAN      NOT NULL DEFAULT FALSE,
    role            VARCHAR(20)  NOT NULL DEFAULT 'USER',
    xp              INTEGER      NOT NULL DEFAULT 0 CHECK (xp >= 0),
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_xp ON users(xp DESC);

-- ----------------------------------------------------------------
-- SECTIONS — référencées par user_profiles, courses, delegate_history
-- ----------------------------------------------------------------
CREATE TABLE sections (
    id          BIGSERIAL    PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    icon        VARCHAR(255),
    approved    BOOLEAN      NOT NULL DEFAULT FALSE
);

-- ----------------------------------------------------------------
-- USER_PROFILES — données profil (1:1 avec users via shared PK)
-- ----------------------------------------------------------------
CREATE TABLE user_profiles (
    user_id              BIGINT       PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name           VARCHAR(50),
    last_name            VARCHAR(50),
    display_real_name    BOOLEAN      NOT NULL DEFAULT FALSE,
    bio                  VARCHAR(500),
    website              VARCHAR(255),
    github               VARCHAR(255),
    linkedin             VARCHAR(255),
    discord              VARCHAR(255),
    -- Photo de profil Discord, capturée à la connexion. Affichée si avatar_source = 'DISCORD'.
    discord_avatar_url   VARCHAR(512),
    -- Section académique auto-déclarée (optionnelle). SET NULL si la section est supprimée.
    section_id           BIGINT       REFERENCES sections(id) ON DELETE SET NULL,
    profile_public       BOOLEAN      NOT NULL DEFAULT TRUE,
    show_in_carousel     BOOLEAN      NOT NULL DEFAULT TRUE,
    avatar_source        VARCHAR(20)  NOT NULL DEFAULT 'AUTO'
                            CHECK (avatar_source IN ('AUTO', 'LETTER', 'DICEBEAR', 'DISCORD')),
    -- Entitlement ad-free = ad_free_until > now() (aucun booléen miroir : il ne s'éteindrait jamais).
    ad_free_until        TIMESTAMP,
    terms_accepted_at    TIMESTAMP
);

CREATE INDEX idx_user_profiles_section ON user_profiles(section_id);

-- ----------------------------------------------------------------
-- USER_OAUTH_LINKS — N:1 OAuth providers liés (Discord seulement)
-- ----------------------------------------------------------------
CREATE TABLE user_oauth_links (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider    VARCHAR(20)  NOT NULL CHECK (provider IN ('DISCORD')),
    oauth_id    VARCHAR(255) NOT NULL,
    linked_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT user_oauth_links_unique UNIQUE (provider, oauth_id)
);

CREATE INDEX idx_user_oauth_links_user ON user_oauth_links(user_id);

-- ----------------------------------------------------------------
-- PROFESSORS
-- ----------------------------------------------------------------
CREATE TABLE professors (
    id          BIGSERIAL    PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    approved    BOOLEAN      NOT NULL DEFAULT FALSE
);

-- ----------------------------------------------------------------
-- COURSES
-- ----------------------------------------------------------------
CREATE TABLE courses (
    id          BIGSERIAL    PRIMARY KEY,
    section_id  BIGINT       NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    approved    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_by  BIGINT       REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_courses_section_approved ON courses(section_id, approved);

-- ----------------------------------------------------------------
-- DOCUMENTS — métadonnées + compteurs dénormalisés
-- ----------------------------------------------------------------
CREATE TABLE documents (
    id              BIGSERIAL       PRIMARY KEY,
    course_id       BIGINT          NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    category        VARCHAR(50)     NOT NULL,
    -- 512, not 255: the raw title is capped at 200 chars but HTML-entity escaping at persistence
    -- (' " < > &) can expand it well past 255 (e.g. a French title full of apostrophes → &#x27;).
    title           VARCHAR(512)    NOT NULL,
    file_key        VARCHAR(512)    NOT NULL,
    user_id         BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    anonymous       BOOLEAN         NOT NULL DEFAULT FALSE,
    verified        BOOLEAN         NOT NULL DEFAULT FALSE,
    language        VARCHAR(10)     NOT NULL DEFAULT 'FR',
    ai_generated    BOOLEAN         NOT NULL DEFAULT FALSE,
    year            VARCHAR(20),
    professor_id    BIGINT          REFERENCES professors(id) ON DELETE SET NULL,
    file_size       BIGINT          NOT NULL CHECK (file_size > 0),
    download_count  INTEGER         NOT NULL DEFAULT 0 CHECK (download_count >= 0),
    average_rating  NUMERIC(3, 2)   NOT NULL DEFAULT 0 CHECK (average_rating >= 0 AND average_rating <= 5),
    rating_count    INTEGER         NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_course_category         ON documents(course_id, category);
CREATE INDEX idx_documents_user                    ON documents(user_id);
CREATE INDEX idx_documents_created_at              ON documents(created_at);
CREATE INDEX idx_documents_download_count          ON documents(download_count DESC);
CREATE INDEX idx_documents_course_verified_created ON documents(course_id, verified, created_at DESC);
-- File de modération admin (findByVerifiedFalse) : index partiel sur le sous-ensemble en attente.
CREATE INDEX idx_documents_unverified              ON documents(created_at DESC) WHERE verified = false;

-- ----------------------------------------------------------------
-- TAGS — N:1 documents, dédupliqué par (document, label)
-- ----------------------------------------------------------------
CREATE TABLE tags (
    id              BIGSERIAL    PRIMARY KEY,
    document_id     BIGINT       NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    label           VARCHAR(255) NOT NULL,
    CONSTRAINT uq_tag_document_label UNIQUE (document_id, label)
);

CREATE INDEX idx_tags_document ON tags(document_id);
CREATE INDEX idx_tags_label    ON tags(label);

-- ----------------------------------------------------------------
-- RATINGS — 1 note par (document, user), score 1-5
-- ----------------------------------------------------------------
CREATE TABLE ratings (
    id              BIGSERIAL    PRIMARY KEY,
    document_id     BIGINT       NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id         BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score           INTEGER      NOT NULL CHECK (score >= 1 AND score <= 5),
    UNIQUE (document_id, user_id)
);

CREATE INDEX idx_ratings_document ON ratings(document_id);

-- ----------------------------------------------------------------
-- FAVORITES — toggle user ↔ document
-- ----------------------------------------------------------------
CREATE TABLE favorites (
    id              BIGSERIAL    PRIMARY KEY,
    user_id         BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id     BIGINT       NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    UNIQUE (user_id, document_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);

-- ----------------------------------------------------------------
-- REPORTS — modération
-- ----------------------------------------------------------------
CREATE TABLE reports (
    id              BIGSERIAL     PRIMARY KEY,
    document_id     BIGINT        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id         BIGINT        REFERENCES users(id) ON DELETE SET NULL,
    reason          VARCHAR(1000) NOT NULL,
    status          VARCHAR(50)   NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMP     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_report_document_user UNIQUE (document_id, user_id)
);

CREATE INDEX idx_reports_status   ON reports(status);
CREATE INDEX idx_reports_document ON reports(document_id);
CREATE INDEX idx_reports_pending  ON reports(id) WHERE status = 'PENDING';

-- ----------------------------------------------------------------
-- DONATIONS — Ko-fi + grants admin manuels
-- ----------------------------------------------------------------
-- kofi_transaction_id unique : empêche le double-traitement d'un webhook (retry/rejeu Ko-fi).
-- Ko-fi fournit un id de transaction unique ; les grants manuels utilisent "MANUAL-{adminId}-{ts}".
CREATE TABLE donations (
    id                    BIGSERIAL       PRIMARY KEY,
    user_id               BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    amount                NUMERIC(10, 2)  NOT NULL,
    kofi_transaction_id   VARCHAR(255)    NOT NULL,
    ad_free_until         TIMESTAMP,
    CONSTRAINT uq_donations_kofi_tx UNIQUE (kofi_transaction_id)
);

-- ----------------------------------------------------------------
-- DELEGATE_HISTORY — mandats des délégués de section
-- ----------------------------------------------------------------
-- Plusieurs délégués actifs par section autorisés (pas d'index unique partiel) ;
-- la règle « une section par user » est appliquée en logique service.
CREATE TABLE delegate_history (
    id              BIGSERIAL    PRIMARY KEY,
    user_id         BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    section_id      BIGINT       NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    start_date      DATE         NOT NULL,
    end_date        DATE,
    CONSTRAINT chk_delegate_dates_order CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_delegate_history_end_date ON delegate_history(end_date);
CREATE INDEX idx_delegate_history_user     ON delegate_history(user_id);

-- ----------------------------------------------------------------
-- NOTIFICATIONS — file persistante (SSE-driven)
-- ----------------------------------------------------------------
CREATE TABLE notifications (
    id              BIGSERIAL    PRIMARY KEY,
    user_id         BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(64)  NOT NULL,
    payload         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    read_at         TIMESTAMP,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created_at  ON notifications(created_at);

-- ----------------------------------------------------------------
-- BANS — liste de bannissement permanente (survit à la suppression du compte)
-- ----------------------------------------------------------------
-- Un ban est créé depuis le hash de l'email ISFCE vérifié ET le(s) lien(s) Discord :
-- re-connexion avec le même Discord bloquée, re-vérif du même @isfce.be bloquée.
-- Retour possible seulement avec un nouveau Discord ET une nouvelle adresse ISFCE.
CREATE TABLE bans (
    id              BIGSERIAL    PRIMARY KEY,
    email_hash      VARCHAR(255),
    oauth_provider  VARCHAR(20),
    oauth_id        VARCHAR(255),
    reason          VARCHAR(500),
    banned_by       BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ban_has_identity
        CHECK (email_hash IS NOT NULL OR (oauth_provider IS NOT NULL AND oauth_id IS NOT NULL))
);

CREATE INDEX idx_bans_email_hash ON bans(email_hash);
CREATE INDEX idx_bans_oauth      ON bans(oauth_provider, oauth_id);
