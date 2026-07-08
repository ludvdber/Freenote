-- Groupes d'équivalence de cours : le même cours donné dans plusieurs sections (ex. Statistiques
-- en Informatique ET en Comptabilité). Les cours d'un même groupe partagent leurs documents,
-- quiz et paquets dans tous les filtres « par cours » (browse, recherche, Réviser ce cours…).
-- NULL = cours non lié — comportement strictement inchangé pour tout l'existant.
ALTER TABLE courses ADD COLUMN equivalence_group BIGINT;

CREATE INDEX idx_courses_equivalence_group ON courses (equivalence_group);

-- Générateur d'identifiants de groupe : ne JAMAIS réutiliser un id de cours comme id de groupe
-- (un groupe dissous puis recréé sur la même ancre fusionnerait avec un vieux groupe fantôme).
CREATE SEQUENCE course_equivalence_seq;
