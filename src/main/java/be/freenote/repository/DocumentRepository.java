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
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentRepository extends JpaRepository<Document, Long> {

    /** Public teaser listing: only VERIFIED docs in the copyright-safe categories (Notes/Divers),
     *  newest first, with course + section fetch-joined to avoid N+1 over the page. */
    @Query(value = """
        SELECT d FROM Document d
        LEFT JOIN FETCH d.course c LEFT JOIN FETCH c.section
        WHERE d.verified = true AND d.category IN :categories
        ORDER BY d.createdAt DESC
        """,
        countQuery = "SELECT COUNT(d) FROM Document d WHERE d.verified = true AND d.category IN :categories")
    Page<Document> findPublicExcerpts(@Param("categories") Collection<Category> categories, Pageable pageable);

    /** Titre seul d'un doc VÉRIFIÉ — statut public « existe mais réservé » d'un lien partagé. */
    @Query("SELECT d.title FROM Document d WHERE d.id = :id AND d.verified = true")
    Optional<String> findVerifiedTitleById(@Param("id") Long id);

    /** A single public teaser by id — present only if verified AND in an allowed public category. */
    @Query("""
        SELECT d FROM Document d
        LEFT JOIN FETCH d.course c LEFT JOIN FETCH c.section
        WHERE d.id = :id AND d.verified = true AND d.category IN :categories
        """)
    Optional<Document> findPublicExcerptById(@Param("id") Long id, @Param("categories") Collection<Category> categories);
    /** Popular docs for the home page: verified ones first (admin-reviewed), then unverified,
     *  each group ordered by download count. Both are visible — verification is a visual aid only.
     *  All mapper associations are fetch-joined (anti-N+1 over the top-10). */
    @Query("""
        SELECT d FROM Document d
        LEFT JOIN FETCH d.course c LEFT JOIN FETCH c.section
        LEFT JOIN FETCH d.user u LEFT JOIN FETCH u.profile
        LEFT JOIN FETCH d.professor
        ORDER BY d.verified DESC, d.downloadCount DESC
        """)
    List<Document> findPopularWithAssociations(Pageable pageable);

    /** Popular docs with the user's own section floated to the top (without hiding other sections). */
    @Query("""
        SELECT d FROM Document d
        LEFT JOIN FETCH d.course c LEFT JOIN FETCH c.section s
        LEFT JOIN FETCH d.user u LEFT JOIN FETCH u.profile
        LEFT JOIN FETCH d.professor
        ORDER BY CASE WHEN s.id = :sectionId THEN 0 ELSE 1 END,
                 d.verified DESC, d.downloadCount DESC
        """)
    List<Document> findPopularPrioritizingSection(@Param("sectionId") Long sectionId, Pageable pageable);

    /** Flexible filter: any combination of section / course / category. NULL params mean "no constraint".
     *  Returns BOTH verified and unverified documents (verification is a visual aid, not access control),
     *  always verified-first; the secondary sort (date/vues/note) comes from the Pageable — Spring Data
     *  appends it to the ORDER BY below. Mapper associations fetch-joined (anti-N+1: without
     *  them, a 20-doc page fired up to 80 lazy SELECTs — course, section, uploader profile, professor). */
    @Query(value = """
        SELECT d FROM Document d
        LEFT JOIN FETCH d.course c LEFT JOIN FETCH c.section s
        LEFT JOIN FETCH d.user u LEFT JOIN FETCH u.profile
        LEFT JOIN FETCH d.professor
        WHERE (:sectionId IS NULL OR s.id = :sectionId)
          AND (:courseId IS NULL OR c.id = :courseId)
          AND (:category IS NULL OR d.category = :category)
        ORDER BY d.verified DESC
        """,
        countQuery = """
        SELECT COUNT(d) FROM Document d
        WHERE (:sectionId IS NULL OR d.course.section.id = :sectionId)
          AND (:courseId IS NULL OR d.course.id = :courseId)
          AND (:category IS NULL OR d.category = :category)
        """)
    Page<Document> findFiltered(
            @Param("sectionId") Long sectionId,
            @Param("courseId") Long courseId,
            @Param("category") Category category,
            Pageable pageable);

    /** Batch fetch by Meilisearch result ids with all mapper associations joined — the search path
     *  equivalent of findFiltered's anti-N+1 (order is re-established by the caller from the ids). */
    @Query("""
        SELECT d FROM Document d
        LEFT JOIN FETCH d.course c LEFT JOIN FETCH c.section
        LEFT JOIN FETCH d.user u LEFT JOIN FETCH u.profile
        LEFT JOIN FETCH d.professor
        WHERE d.id IN :ids
        """)
    List<Document> findAllByIdWithAssociations(@Param("ids") Collection<Long> ids);
    long countByCreatedAtAfter(LocalDateTime dateTime);

    /** File d'attente de vérification admin : plus ancien d'abord (file équitable), paginée, avec
     *  toutes les associations du mapper fetch-joinées (course→section, user→profile, professor)
     *  pour éviter le N+1 sur la page. */
    @Query(value = """
        SELECT d FROM Document d
        LEFT JOIN FETCH d.course c LEFT JOIN FETCH c.section
        LEFT JOIN FETCH d.user u LEFT JOIN FETCH u.profile
        LEFT JOIN FETCH d.professor
        WHERE d.verified = false
        ORDER BY d.createdAt ASC
        """,
        countQuery = "SELECT COUNT(d) FROM Document d WHERE d.verified = false")
    Page<Document> findPendingForReview(Pageable pageable);

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

    /** Verified docs of a user's public profile, mapper associations fetch-joined (anti-N+1). */
    @Query(value = """
        SELECT d FROM Document d
        LEFT JOIN FETCH d.course c LEFT JOIN FETCH c.section
        LEFT JOIN FETCH d.user u LEFT JOIN FETCH u.profile
        LEFT JOIN FETCH d.professor
        WHERE u.id = :userId AND d.verified = true
        """,
        countQuery = "SELECT COUNT(d) FROM Document d WHERE d.user.id = :userId AND d.verified = true")
    Page<Document> findByUserIdAndVerifiedTrue(@Param("userId") Long userId, Pageable pageable);

    /** ALL docs of a user (y compris en attente de vérification) — réservé à l'auteur lui-même :
     *  « Mes documents » doit lui montrer ses docs en attente, sinon il en perd la trace. */
    @Query(value = """
        SELECT d FROM Document d
        LEFT JOIN FETCH d.course c LEFT JOIN FETCH c.section
        LEFT JOIN FETCH d.user u LEFT JOIN FETCH u.profile
        LEFT JOIN FETCH d.professor
        WHERE u.id = :userId
        ORDER BY d.createdAt DESC
        """,
        countQuery = "SELECT COUNT(d) FROM Document d WHERE d.user.id = :userId")
    Page<Document> findByUserIdWithAssociations(@Param("userId") Long userId, Pageable pageable);

    /** Content-based duplicate check: an existing document with the same PDF hash, if any. */
    Optional<Document> findFirstByFileHash(String fileHash);

    /** Documents still missing a content hash — drained once by the startup backfill. */
    List<Document> findByFileHashIsNull();

    /** All documents sharing a given content hash (a duplicate group). */
    List<Document> findAllByFileHash(String fileHash);

    /** Content hashes shared by ≥2 documents — i.e. groups of exact duplicates already in the DB. */
    @Query("SELECT d.fileHash FROM Document d WHERE d.fileHash IS NOT NULL "
            + "GROUP BY d.fileHash HAVING COUNT(d) > 1")
    List<String> findDuplicateHashes();

    /** Soft duplicate signal: a same-titled document already exists in the same course. */
    boolean existsByTitleIgnoreCaseAndCourseId(String title, Long courseId);

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

    /** Vues cumulées de tous les documents d'un utilisateur (tuiles profil /users/:id). */
    @Query("SELECT COALESCE(SUM(d.downloadCount), 0) FROM Document d WHERE d.user.id = :userId")
    long sumDownloadCountByUserId(@Param("userId") Long userId);

    @Query("SELECT DISTINCT d FROM Document d " +
           "LEFT JOIN FETCH d.course c " +
           "LEFT JOIN FETCH c.section " +
           "LEFT JOIN FETCH d.professor")
    List<Document> findAllWithAssociations();
}
