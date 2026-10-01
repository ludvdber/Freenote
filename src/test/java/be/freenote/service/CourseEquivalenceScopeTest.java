package be.freenote.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Règle de portée des filtres quand les équivalences de cours (V15) entrent en jeu.
 *
 * <p>Le bug qu'elle corrige était invisible à la lecture de chaque filtre pris séparément : lier
 * « Statistiques » (Informatique) à « Statistiques » (Marketing) étend bien le filtre cours aux deux
 * identifiants, mais le filtre section — envoyé en même temps par l'Explorer, qui garde la section
 * choisie avant le cours — recoupait le résultat avec <i>une seule</i> section. L'intersection ne
 * gardait donc que les documents déjà visibles sans équivalence : la liste paraissait vide côté
 * cours lié, et la fonctionnalité semblait exiger un redémarrage alors qu'elle n'avait jamais pu
 * fonctionner.</p>
 */
class CourseEquivalenceScopeTest {

    @Test
    void gardeLaSectionQuandAucunCoursNEstFiltre() {
        assertThat(CourseEquivalenceService.scopeSection(3L, null)).isEqualTo(3L);
    }

    /** Le filtre cours, plus précis, l'emporte : sinon il exclut ses propres équivalents. */
    @Test
    void neutraliseLaSectionDesQuUnCoursEstFiltre() {
        assertThat(CourseEquivalenceService.scopeSection(3L, 10L)).isNull();
    }

    @Test
    void resteNulQuandAucunFiltreNEstActif() {
        assertThat(CourseEquivalenceService.scopeSection(null, null)).isNull();
        assertThat(CourseEquivalenceService.scopeSection(null, 10L)).isNull();
    }
}
