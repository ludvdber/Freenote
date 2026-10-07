package be.freenote.service;

import java.util.List;

/**
 * Expansion des groupes d'équivalence de cours (V15) : un filtre « par cours » devient un filtre
 * « par groupe de cours équivalents » partout où il est appliqué (documents, quiz, paquets).
 * Service dédié minuscule pour ne pas injecter tout CourseService dans les services consommateurs.
 */
public interface CourseEquivalenceService {

    /**
     * Tous les ids du groupe d'équivalence du cours (le cours lui-même inclus).
     * {@code null} en entrée (pas de filtre cours) → {@code null} en sortie ;
     * cours non lié → liste singleton {@code [courseId]}.
     */
    List<Long> expand(Long courseId);

    /**
     * Périmètre complet d'un filtre Explorer (section et/ou cours), équivalences comprises.
     *
     * <p>Avec un cours : le groupe du cours, section neutralisée (voir {@link #scopeSection}).
     * Avec une section seule : les cours de la section PLUS ceux qui leur sont liés ailleurs. Sans
     * ce second cas, une section dont le seul cours alimenté est un cours lié (« Statistiques » en
     * Marketing, documents déposés côté Informatique) affichait « aucun document » en vue globale,
     * alors que choisir le cours les montrait : l'étudiant concluait qu'il n'y avait rien et
     * s'arrêtait là. Une section sans aucun cours lié garde son filtre section tel quel.</p>
     */
    Scope resolve(Long sectionId, Long courseId);

    /** {@code courseIds == null} = pas de filtre cours ; {@code sectionId == null} = pas de filtre section. */
    record Scope(Long sectionId, List<Long> courseIds) {}

    /**
     * Portée « section » à appliquer À CÔTÉ d'un filtre cours déjà étendu aux équivalences.
     *
     * <p>Un groupe d'équivalence traverse justement les sections (« Statistiques » en Informatique
     * ET en Marketing) : conserver le filtre section en plus du filtre cours exclurait exactement
     * les documents que l'expansion vient d'inclure — le cours équivalent appartient, par
     * définition, à une AUTRE section. Le filtre cours est le plus précis des deux : il gagne, et
     * la section est neutralisée. Même règle qu'à l'écriture ({@code resolveSection} : un cours
     * impose SA section, on ne lui en superpose pas une seconde).</p>
     */
    static Long scopeSection(Long sectionId, Long courseId) {
        return courseId == null ? sectionId : null;
    }
}
