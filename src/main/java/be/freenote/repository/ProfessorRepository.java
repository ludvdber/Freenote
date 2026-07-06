package be.freenote.repository;

import be.freenote.entity.Professor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProfessorRepository extends JpaRepository<Professor, Long> {
    List<Professor> findByApprovedFalse();
    List<Professor> findByApprovedTrue();
    List<Professor> findAllByOrderByNameAsc();
    boolean existsByNameIgnoreCase(String name);
}
