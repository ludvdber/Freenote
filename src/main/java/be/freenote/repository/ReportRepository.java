package be.freenote.repository;

import be.freenote.entity.Report;
import be.freenote.enums.ReportStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReportRepository extends JpaRepository<Report, Long> {
    Page<Report> findByStatus(ReportStatus status, Pageable pageable);
    List<Report> findByUserId(Long userId);

    /** Badge « Signalements » de la sidebar admin. */
    long countByStatus(ReportStatus status);
}
