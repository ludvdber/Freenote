-- Signalements « triables » et décisions tracées.
--
-- Avant : un signalement = un texte libre + un statut. Côté admin, « Résoudre » et « Rejeter »
-- écrivaient DEUX statuts différents pour EXACTEMENT le même effet (rien) : la ligne quittait la
-- file en laissant croire qu'on avait agi, sans jamais toucher le document ni prévenir personne.
--
--   type            : nature du problème, choisie par l'auteur du signalement → l'admin trie sa
--                     file par problème (une demande de suppression n'a pas la même urgence
--                     qu'une suggestion d'amélioration). DEFAULT 'AUTRE' pour l'existant, qui
--                     n'avait qu'un texte libre.
--   resolution      : ce qui a RÉELLEMENT été fait (NO_ACTION / EDITED / UNVERIFIED / DELETED /
--                     REJECTED) — la décision devient vérifiable après coup.
--   resolution_note : mot de l'admin, renvoyé au signaleur dans sa notification.
--   resolved_by/at  : qui a tranché et quand (ON DELETE SET NULL : la trace survit au départ de
--                     l'admin, même convention que activity_logs.actor_id et bans.banned_by).
ALTER TABLE reports ADD COLUMN type            VARCHAR(32) NOT NULL DEFAULT 'AUTRE';
ALTER TABLE reports ADD COLUMN resolution      VARCHAR(32);
ALTER TABLE reports ADD COLUMN resolution_note VARCHAR(500);
ALTER TABLE reports ADD COLUMN resolved_by     BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN resolved_at     TIMESTAMP;

-- La file admin se lit « en attente, filtrée par type » — l'index couvre les deux colonnes du WHERE.
CREATE INDEX idx_reports_status_type ON reports (status, type);
