package be.freenote.repository;

import be.freenote.entity.Document;
import be.freenote.enums.Category;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface DocumentRepository extends JpaRepository<Document, Long> {
    /** Popular docs for the home page: verified ones first (admin-reviewed), then unverified,
     *  each group ordered by download count. Both are visible — verification is a visual aid only. */
    List<Document> findTop10ByOrderByVerifiedDescDownloadCountDesc();

    /** Popular docs with the user's own section floated to the top (without hiding other sections). */
    @Query("""
        SELECT d FROM Document d
        ORDER BY CASE WHEN d.course.section.id = :sectionId THEN 0 ELSE 1 END,
                 d.verified DESC, d.downloadCount DESC
        """)
    List<Document> findPopularPrioritizingSection(@Param("sectionId") Long sectionId, Pageable pageable);

    /** Flexible filter: any combination of section / course / category. NULL params mean "no constraint".
     *  Returns BOTH verified and unverified documents (verification is a visual aid, not access control),
     *  ordered verified-first then newest-first. */
    @Query("""
        SELECT d FROM Document d
        WHERE (:sectionId IS NULL OR d.course.section.id = :sectionId)
          AND (:courseId IS NULL OR d.course.id = :courseId)
          AND (:category IS NULL OR d.category = :category)
        ORDER BY d.verified DESC, d.createdAt DESC
        """)
    Page<Document> findFiltered(
            @Param("sectionId") Long sectionId,
            @Param("courseId") Long courseId,
            @Param("category") Category category,
            Pageable pageable);
    long countByCreatedAtAfter(LocalDateTime dateTime);
    List<Document> findByVerifiedFalse();
    long countByUserId(Long userId);
    long countByCourseId(Long courseId);

    /** Professor IDs used on documents of a given course, most-used first — drives the
     *  data-driven "suggested professor" auto-fill on the upload form. */
    @Query("""
        SELECT d.professor.id FROM Document d
        WHERE d.course.id = :courseId AND d.professor IS NOT NULL
        GROUP BY d.professor.id
        ORDER BY COUNT(d) DESC
        """)
    List<Long> findProfessorIdsByCourseRankedByUsage(@Param("courseId") Long courseId);

    @Query("SELECT COUNT(d) FROM Document d WHERE d.course.section.id = :sectionId")
    long countBySectionId(@Param("sectionId") Long sectionId);

    /** Batch count: returns a map of userId → documentCount for all given user IDs in one query. */
    @Query("SELECT d.user.id, COUNT(d) FROM Document d WHERE d.user.id IN :userIds GROUP BY d.user.id")
    List<Object[]> countByUserIds(@Param("userIds") List<Long> userIds);

    Page<Document> findByUserIdAndVerifiedTrue(Long userId, Pageable pageable);

    @Modifying
    @Query("UPDATE Document d SET d.anonymous = true, d.user = null WHERE d.user.id = :userId")
    void anonymizeByUserId(@Param("userId") Long userId);

    @Modifying
    @Query("UPDATE Document d SET d.downloadCount = d.downloadCount + :increment WHERE d.id = :docId")
    void incrementDownloadCount(@Param("docId") Long docId, @Param("increment") int increment);

    /** Recompute the denormalized rating counters from the ratings table in a single atomic
     *  statement — exact (no rounding drift) and safe under concurrent votes. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
        UPDATE Document d
        SET d.ratingCount = (SELECT COUNT(r) FROM Rating r WHERE r.document = d),
            d.averageRating = (SELECT COALESCE(AVG(r.score), 0) FROM Rating r WHERE r.document = d)
        WHERE d.id = :docId
        """)
    void recalcRatingStats(@Param("docId") Long docId);

    @Query("SELECT COALESCE(SUM(d.downloadCount), 0) FROM Document d")
    long sumDownloadCount();

    @Query("SELECT DISTINCT d FROM Document d " +
           "LEFT JOIN FETCH d.course c " +
           "LEFT JOIN FETCH c.section " +
           "LEFT JOIN FETCH d.professor")
    List<Document> findAllWithAssociations();
}
