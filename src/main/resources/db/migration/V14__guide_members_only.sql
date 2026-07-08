-- V14 : guide « réservé aux étudiants » (2026-07-08).
-- Un guide members_only garde sa carte dans l'index public (titre + résumé, avec cadenas),
-- mais son CONTENU n'est servi qu'aux comptes vérifiés — pour les guides contenant des
-- éléments de cours / infos internes ISFCE. Additive, aucun impact sur l'existant :
-- le guide déjà en prod reste public (DEFAULT FALSE).
ALTER TABLE guides ADD COLUMN members_only BOOLEAN NOT NULL DEFAULT FALSE;
