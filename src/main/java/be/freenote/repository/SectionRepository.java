package be.freenote.repository;

import be.freenote.entity.Section;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SectionRepository extends JpaRepository<Section, Long> {

    // ORDER BY s.name : les dropdowns (upload, CourseSelect, filtres) affichent la liste telle
    // quelle — sans ordre explicite, PG renvoie un ordre imprévisible (règle 2026-07-08 : tout
    // dropdown est alphabétique par défaut).
    @Query("""
        SELECT s.id AS id, s.name AS name, s.icon AS icon, s.approved AS approved, COUNT(d.id) AS documentCount
        FROM Section s
        LEFT JOIN s.courses c
        LEFT JOIN c.documents d
        WHERE s.approved = true
        GROUP BY s.id, s.name, s.icon, s.approved
        ORDER BY s.name
        """)
    List<SectionWithDocCount> findAllApprovedWithDocCount();

    @Query("""
        SELECT s.id AS id, s.name AS name, s.icon AS icon, s.approved AS approved, COUNT(d.id) AS documentCount
        FROM Section s
        LEFT JOIN s.courses c
        LEFT JOIN c.documents d
        GROUP BY s.id, s.name, s.icon, s.approved
        ORDER BY s.name
        """)
    List<SectionWithDocCount> findAllWithDocCount();

    boolean existsByNameIgnoreCase(String name);

    interface SectionWithDocCount {
        Long getId();
        String getName();
        String getIcon();
        Boolean getApproved();
        Long getDocumentCount();
    }
}
