-- ================================================================
-- V11 — APP_SETTINGS : réglages du site éditables via l'admin
-- ================================================================
-- Migration ADDITIVE (après V1 baseline déployée + V2..V10). Un seul CREATE TABLE,
-- aucune table existante n'est touchée.
--
-- Table clé-valeur générique : premier consommateur = le compte à rebours de la
-- rentrée (clés `countdown.date` + `countdown.label`, bannière de la home masquée
-- automatiquement une fois la date passée). Les colonnes sont préfixées setting_
-- pour éviter les mots-clés (`key` est réservé en JPQL, `value` fragile selon les
-- dialectes).
CREATE TABLE app_settings (
    setting_key   VARCHAR(100) PRIMARY KEY,
    setting_value TEXT,
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);
