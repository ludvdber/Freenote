package be.freenote.repository;

import be.freenote.entity.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CourseRepository extends JpaRepository<Course, Long> {
    List<Course> findByApprovedFalse();

    // ORDER BY c.name (couvert par GROUP BY c — functional dependency PG) : les dropdowns cours
    // affichent la liste telle quelle, alphabétique par défaut (règle 2026-07-08).
    @Query("""
        SELECT c, COUNT(d.id)
        FROM Course c
        LEFT JOIN c.documents d
        WHERE c.section.id = :sectionId AND c.approved = true
        GROUP BY c
        ORDER BY c.name
        """)
    List<Object[]> findApprovedBySectionIdWithDocCount(@Param("sectionId") Long sectionId);

    @Query("""
        SELECT c, COUNT(d.id)
        FROM Course c
        LEFT JOIN c.documents d
        GROUP BY c, c.section.name
        ORDER BY c.section.name, c.name
        """)
    List<Object[]> findAllWithDocCount();

    boolean existsBySectionIdAndNameIgnoreCase(Long sectionId, String name);

    // --- Équivalences de cours (V15) ---

    @Query("SELECT c.equivalenceGroup FROM Course c WHERE c.id = :id")
    Long findEquivalenceGroupById(@Param("id") Long id);

    @Query("SELECT c.id FROM Course c WHERE c.equivalenceGroup = :group")
    List<Long> findIdsByEquivalenceGroup(@Param("group") Long group);

    /** Groupes d'équivalence touchant une section — vide si aucun de ses cours n'est lié. */
    @Query("SELECT DISTINCT c.equivalenceGroup FROM Course c WHERE c.section.id = :sectionId AND c.equivalenceGroup IS NOT NULL")
    List<Long> findEquivalenceGroupsBySectionId(@Param("sectionId") Long sectionId);

    /** Cours d'une section + tous les membres des groupes donnés (section élargie aux équivalences). */
    @Query("SELECT c.id FROM Course c WHERE c.section.id = :sectionId OR c.equivalenceGroup IN :groups")
    List<Long> findIdsBySectionIdOrEquivalenceGroupIn(@Param("sectionId") Long sectionId,
                                                     @Param("groups") List<Long> groups);

    /** Membres d'un groupe avec leur section (bandeau page cours + dialog admin — anti-N+1). */
    @Query("SELECT c FROM Course c JOIN FETCH c.section WHERE c.equivalenceGroup = :group ORDER BY c.name")
    List<Course> findByEquivalenceGroupWithSection(@Param("group") Long group);

    /**
     * Cours approuvés auxquels AUCUN document n'est rattaché — page publique « ce qui manque ».
     * { NOT EXISTS} plutôt qu'un { GROUP BY … HAVING COUNT(d) = 0} : PostgreSQL est strict
     * sur le GROUP BY dès qu'une colonne de la table jointe apparaît ailleurs (voir le piège
     * documenté dans CLAUDE.md), et la section est justement fetch-jointe ici pour le groupage.
     * Un cours LIÉ à un cours alimenté n'est pas un manque : sa page et l'Explorer montrent déjà ces
     * documents (équivalences V15), l'annoncer vide contredirait ce que l'étudiant voit en cliquant.
     */
    @Query("""
        SELECT c FROM Course c JOIN FETCH c.section
        WHERE c.approved = true
          AND NOT EXISTS (SELECT 1 FROM Document d JOIN d.course dc
                          WHERE dc = c
                             OR (c.equivalenceGroup IS NOT NULL AND dc.equivalenceGroup = c.equivalenceGroup))
        """)
    List<Course> findApprovedWithoutDocuments();

    long countByApprovedTrue();

    /** Id de groupe frais — jamais un id de cours réutilisé (voir le commentaire de V15). */
    @Query(value = "SELECT nextval('course_equivalence_seq')", nativeQuery = true)
    Long nextEquivalenceGroup();
}
