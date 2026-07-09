-- V16 — Avantages supporters (dons Ko-fi) + thermomètre de financement.
-- Additive uniquement : la baseline V1 et les migrations V2..V15 sont GELÉES.

-- Dons : horodatage (agrégat mensuel du thermomètre) + message Ko-fi (porte le code
-- personnel « FN-… » utilisé pour rattacher le don à un compte Freenote).
-- NB : ADD COLUMN ... DEFAULT now() remplit aussi les lignes existantes (date d'exécution
-- de la migration, approximation assumée — l'historique pré-V16 n'a pas de date fiable).
ALTER TABLE donations ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE donations ADD COLUMN message VARCHAR(500);

-- Perks côté profil :
--   lifetime_supporter : un don unique >= 5 EUR => palettes d'accent illimitées + rôle
--                        Discord « Supporter » (jamais réinitialisé).
--   palettes_until     : un don < 5 EUR => palettes d'accent pendant 30 jours (cumulatif,
--                        même mécanique que ad_free_until : l'entitlement dérive du timestamp).
--   accent_palette     : palette choisie par l'utilisateur (NULL = thème cosmique par défaut).
ALTER TABLE user_profiles ADD COLUMN lifetime_supporter BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN palettes_until TIMESTAMP;
ALTER TABLE user_profiles ADD COLUMN accent_palette VARCHAR(20);
