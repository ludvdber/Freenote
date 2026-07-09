package be.freenote.repository;

import be.freenote.entity.ActivityLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {

    Page<ActivityLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<ActivityLog> findByTypeOrderByCreatedAtDesc(String type, Pageable pageable);

    @Modifying
    @Query("DELETE FROM ActivityLog a WHERE a.createdAt < :before")
    int deleteByCreatedAtBefore(@Param("before") LocalDateTime before);

    /** KPI « nouveaux comptes » du panel admin (les SIGNUP sont journalisés ici). */
    long countByTypeAndCreatedAtGreaterThanEqual(String type, LocalDateTime after);
}
