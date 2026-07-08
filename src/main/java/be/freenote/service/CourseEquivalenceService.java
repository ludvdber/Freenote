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
}
