package be.freenote.repository;

import be.freenote.entity.ActivityLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {

    Page<ActivityLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /**
     * Filtres du panel : liste de types ({@code anyType} = pas de filtre — un {@code IN} vide serait du
     * SQL invalide, d'où le drapeau) et texte cherché dans l'acteur OU le message, pour qu'un pseudo
     * remonte aussi les actions du staff qui le visent. {@code text} null = pas de filtre.
     */
    @Query("""
        SELECT a FROM ActivityLog a
        WHERE (:anyType = true OR a.type IN :types)
          AND (:text IS NULL OR LOWER(a.actorName) LIKE :text OR LOWER(a.message) LIKE :text)
        ORDER BY a.createdAt DESC
        """)
    Page<ActivityLog> search(@Param("anyType") boolean anyType, @Param("types") Collection<String> types,
                             @Param("text") String text, Pageable pageable);

    @Modifying
    @Query("DELETE FROM ActivityLog a WHERE a.type IN :types AND a.createdAt < :before")
    int deleteByTypeInAndCreatedAtBefore(@Param("types") Collection<String> types,
                                         @Param("before") LocalDateTime before);

    /** Badge des alertes système non acquittées. */
    long countByTypeAndCreatedAtGreaterThanEqual(String type, LocalDateTime after);

    /** Dernier événement du parcours e-mail de chaque compte bloqué à l'inscription (le plus récent d'abord). */
    @Query("""
        SELECT a FROM ActivityLog a
        WHERE a.actorId IN :actorIds AND a.type LIKE 'EMAIL%'
        ORDER BY a.createdAt DESC
        """)
    List<ActivityLog> findEmailEventsOf(@Param("actorIds") Collection<Long> actorIds);
}
