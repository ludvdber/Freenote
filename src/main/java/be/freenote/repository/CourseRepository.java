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

    /** Membres d'un groupe avec leur section (bandeau page cours + dialog admin — anti-N+1). */
    @Query("SELECT c FROM Course c JOIN FETCH c.section WHERE c.equivalenceGroup = :group ORDER BY c.name")
    List<Course> findByEquivalenceGroupWithSection(@Param("group") Long group);

    /** Id de groupe frais — jamais un id de cours réutilisé (voir le commentaire de V15). */
    @Query(value = "SELECT nextval('course_equivalence_seq')", nativeQuery = true)
    Long nextEquivalenceGroup();
}
