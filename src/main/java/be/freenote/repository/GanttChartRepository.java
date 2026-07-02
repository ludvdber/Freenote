package be.freenote.repository;

import be.freenote.entity.GanttChart;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface GanttChartRepository extends JpaRepository<GanttChart, Long> {

    /** The signed-in user's own projects (private + shared), most-recently edited first. */
    Page<GanttChart> findByOwnerIdOrderByUpdatedAtDesc(Long ownerId, Pageable pageable);

    /** Shared library: owner (+ profile, for the display name) fetch-joined to avoid N+1 over the page. */
    @Query(value = "SELECT g FROM GanttChart g "
            + "LEFT JOIN FETCH g.owner o LEFT JOIN FETCH o.profile "
            + "WHERE g.shared = true ORDER BY g.updatedAt DESC",
            countQuery = "SELECT COUNT(g) FROM GanttChart g WHERE g.shared = true")
    Page<GanttChart> findSharedForListing(Pageable pageable);
}
