-- V17 — Statistiques agrégées par jour (panel admin « Mission Control » + Analytics).
-- Additive uniquement : la baseline V1 et les migrations V2..V16 sont GELÉES.
--
-- Une ligne = (jour, métrique, cible) → compteur. AUCUNE donnée personnelle : les visites sont
-- agrégées par source (organic/social/direct/referral/campaign), les cibles sont des slugs
-- d'outils/guides ou des ids de profils — jamais de visiteur individuel (RGPD-safe, zéro cookie).
-- Alimentée par un buffer Redis (HINCRBY) flushé périodiquement — même pattern que download_count.
CREATE TABLE daily_stats (
    day     DATE          NOT NULL,
    metric  VARCHAR(30)   NOT NULL,
    -- '' quand la métrique n'a pas de cible (une PK ne peut pas contenir de NULL).
    target  VARCHAR(120)  NOT NULL DEFAULT '',
    count   BIGINT        NOT NULL DEFAULT 0,
    PRIMARY KEY (day, metric, target)
);

-- Les agrégats « toutes dates » par cible (ex. vues d'un profil) lisent par (metric, target).
CREATE INDEX idx_daily_stats_metric_target ON daily_stats(metric, target);
