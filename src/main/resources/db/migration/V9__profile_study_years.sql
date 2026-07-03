-- Parcours à l'ISFCE affiché sur le profil : année d'arrivée, année de fin et statut diplômé
-- (badge « Promo {année} » quand graduated + study_end_year sont renseignés).
-- Additive : uniquement des ADD COLUMN nullables / défaut, données prod intactes.
ALTER TABLE user_profiles ADD COLUMN study_start_year INTEGER;
ALTER TABLE user_profiles ADD COLUMN study_end_year INTEGER;
ALTER TABLE user_profiles ADD COLUMN graduated BOOLEAN NOT NULL DEFAULT FALSE;
