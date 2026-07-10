-- Rôles « staff » granulaires (même pattern que users.trusted, V7) :
--   moderator : accès au périmètre Modération du panel admin (documents à vérifier, signalements,
--               doublons, dépublication des quiz/paquets publiés). Relu EN DIRECT en base à chaque
--               requête /api/admin/** (AdminRoleVerificationFilter) — retrait effectif immédiatement.
--   editor    : rédaction de guides (CRUD sur SES propres guides, publication libre — l'admin peut
--               dépublier/supprimer n'importe quel guide).
-- Des booléens plutôt qu'une extension de users.role : les deux rôles sont cumulables entre eux
-- (et orthogonaux à USER/VERIFIED/ADMIN qui reste la hiérarchie d'accès).
ALTER TABLE users ADD COLUMN moderator BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN editor BOOLEAN NOT NULL DEFAULT FALSE;
