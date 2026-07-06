-- L'échappement HTML à l'écriture (HtmlSanitizer, supprimé dans ce même lot) corrompait l'affichage
-- des champs texte : « l'apostrophe » était stocké « l&#x27;apostrophe » et CHAQUE re-sauvegarde du
-- profil ré-échappait les valeurs déjà échappées (« &amp;amp;… », corruption cumulative).
-- Le stockage est désormais BRUT (React échappe au rendu, politique déjà appliquée aux titres).
-- Cette migration dé-échappe les valeurs existantes, itérativement jusqu'au point fixe pour défaire
-- les niveaux empilés. Additive côté schéma (UPDATE only) ; le dé-échappement ne fait que raccourcir
-- les chaînes, donc aucun risque de dépassement de VARCHAR.
-- Limite assumée : un texte où l'utilisateur avait TAPÉ littéralement « &amp; » est dé-échappé aussi
-- (indiscernable de la corruption) — perte théorique minime, prod quasi vide de tels cas.

CREATE FUNCTION pg_temp.unescape_html(v TEXT) RETURNS TEXT
    LANGUAGE sql IMMUTABLE AS
$$
SELECT replace(replace(replace(replace(replace(replace(v,
        '&lt;', '<'),
        '&gt;', '>'),
        '&quot;', '"'),
        '&#x27;', ''''),
        '&#39;', ''''),
        '&amp;', '&');  -- &amp; en DERNIER : une passe = un niveau d'échappement défait
$$;

DO
$$
    DECLARE
        changed INTEGER;
        pass    INTEGER;
    BEGIN
        LOOP
            changed := 0;

            UPDATE user_profiles SET first_name = pg_temp.unescape_html(first_name)
            WHERE first_name IS DISTINCT FROM pg_temp.unescape_html(first_name);
            GET DIAGNOSTICS pass = ROW_COUNT; changed := changed + pass;

            UPDATE user_profiles SET last_name = pg_temp.unescape_html(last_name)
            WHERE last_name IS DISTINCT FROM pg_temp.unescape_html(last_name);
            GET DIAGNOSTICS pass = ROW_COUNT; changed := changed + pass;

            UPDATE user_profiles SET bio = pg_temp.unescape_html(bio)
            WHERE bio IS DISTINCT FROM pg_temp.unescape_html(bio);
            GET DIAGNOSTICS pass = ROW_COUNT; changed := changed + pass;

            UPDATE user_profiles SET website = pg_temp.unescape_html(website)
            WHERE website IS DISTINCT FROM pg_temp.unescape_html(website);
            GET DIAGNOSTICS pass = ROW_COUNT; changed := changed + pass;

            UPDATE user_profiles SET github = pg_temp.unescape_html(github)
            WHERE github IS DISTINCT FROM pg_temp.unescape_html(github);
            GET DIAGNOSTICS pass = ROW_COUNT; changed := changed + pass;

            UPDATE user_profiles SET linkedin = pg_temp.unescape_html(linkedin)
            WHERE linkedin IS DISTINCT FROM pg_temp.unescape_html(linkedin);
            GET DIAGNOSTICS pass = ROW_COUNT; changed := changed + pass;

            UPDATE user_profiles SET discord = pg_temp.unescape_html(discord)
            WHERE discord IS DISTINCT FROM pg_temp.unescape_html(discord);
            GET DIAGNOSTICS pass = ROW_COUNT; changed := changed + pass;

            UPDATE courses SET name = pg_temp.unescape_html(name)
            WHERE name IS DISTINCT FROM pg_temp.unescape_html(name);
            GET DIAGNOSTICS pass = ROW_COUNT; changed := changed + pass;

            UPDATE sections SET name = pg_temp.unescape_html(name)
            WHERE name IS DISTINCT FROM pg_temp.unescape_html(name);
            GET DIAGNOSTICS pass = ROW_COUNT; changed := changed + pass;

            UPDATE sections SET icon = pg_temp.unescape_html(icon)
            WHERE icon IS DISTINCT FROM pg_temp.unescape_html(icon);
            GET DIAGNOSTICS pass = ROW_COUNT; changed := changed + pass;

            UPDATE bans SET reason = pg_temp.unescape_html(reason)
            WHERE reason IS DISTINCT FROM pg_temp.unescape_html(reason);
            GET DIAGNOSTICS pass = ROW_COUNT; changed := changed + pass;

            EXIT WHEN changed = 0; -- point fixe : plus aucun niveau d'échappement à défaire
        END LOOP;
    END
$$;
