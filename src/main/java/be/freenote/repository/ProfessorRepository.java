package be.freenote.repository;

import be.freenote.entity.Professor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProfessorRepository extends JpaRepository<Professor, Long> {
    List<Professor> findByApprovedFalse();
    /** Dropdown de l'upload : alphabétique par défaut (règle 2026-07-08 sur tous les dropdowns). */
    List<Professor> findByApprovedTrueOrderByNameAsc();
    List<Professor> findAllByOrderByNameAsc();
    boolean existsByNameIgnoreCase(String name);
}
