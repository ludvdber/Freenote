package be.freenote.repository;

import be.freenote.entity.Report;
import be.freenote.enums.ReportStatus;
import be.freenote.enums.ReportType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * File de modération des signalements.
 *
 * <p>Les quatre variantes de filtre (statut et/ou type) sont quatre requêtes dérivées plutôt qu'une
 * seule JPQL en {@code :x IS NULL OR r.x = :x} : PostgreSQL refuse de typer un paramètre enum
 * nullable. Toutes portent le même {@code @EntityGraph} — sans lui, afficher 20 signalements
 * coûtait 20 SELECT document + 20 SELECT user (associations LAZY), l'ancienne file était en N+1.
 */
@Repository
public interface ReportRepository extends JpaRepository<Report, Long> {

    @EntityGraph(attributePaths = {"document", "document.course", "document.user", "user", "resolvedBy"})
    @Query("SELECT r FROM Report r")
    Page<Report> findAllForModeration(Pageable pageable);

    @EntityGraph(attributePaths = {"document", "document.course", "document.user", "user", "resolvedBy"})
    Page<Report> findByStatus(ReportStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"document", "document.course", "document.user", "user", "resolvedBy"})
    Page<Report> findByType(ReportType type, Pageable pageable);

    @EntityGraph(attributePaths = {"document", "document.course", "document.user", "user", "resolvedBy"})
    Page<Report> findByStatusAndType(ReportStatus status, ReportType type, Pageable pageable);

    List<Report> findByUserId(Long userId);

    /** Badge « Signalements » de la sidebar admin. */
    long countByStatus(ReportStatus status);

    /** Combien de signalements par type dans un statut donné — compteurs des filtres admin. */
    @Query("SELECT r.type, COUNT(r) FROM Report r WHERE r.status = :status GROUP BY r.type")
    List<Object[]> countByTypeGrouped(@Param("status") ReportStatus status);

    /** Les autres signalements en attente du même document : une décision les tranche TOUS
     *  (supprimer le doc règle les 5 signalements qui le visaient, pas seulement celui ouvert). */
    List<Report> findByDocumentIdAndStatus(Long documentId, ReportStatus status);
}
