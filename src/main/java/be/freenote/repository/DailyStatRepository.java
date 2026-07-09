package be.freenote.repository;

import be.freenote.entity.DailyStat;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface DailyStatRepository extends JpaRepository<DailyStat, DailyStat.DailyStatId> {

    /** Ligne agrégée par jour (le flush Redis arrive par lots) — upsert additif natif PG. */
    @Modifying
    @Query(value = """
            INSERT INTO daily_stats (day, metric, target, count)
            VALUES (:day, :metric, :target, :count)
            ON CONFLICT (day, metric, target) DO UPDATE SET count = daily_stats.count + EXCLUDED.count
            """, nativeQuery = true)
    void upsertAdd(@Param("day") LocalDate day,
                   @Param("metric") String metric,
                   @Param("target") String target,
                   @Param("count") long count);

    /** Somme d'une métrique sur [from, to) toutes cibles confondues. */
    @Query("SELECT COALESCE(SUM(s.count), 0) FROM DailyStat s " +
           "WHERE s.id.metric = :metric AND s.id.day >= :from AND s.id.day < :to")
    long sumBetween(@Param("metric") String metric, @Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Somme toutes dates pour une cible précise (ex. vues cumulées d'un profil). */
    @Query("SELECT COALESCE(SUM(s.count), 0) FROM DailyStat s " +
           "WHERE s.id.metric = :metric AND s.id.target = :target")
    long sumByTarget(@Param("metric") String metric, @Param("target") String target);

    /** Série journalière d'une métrique (les jours sans activité sont absents — zéro-fill en service). */
    @Query("SELECT s.id.day AS day, SUM(s.count) AS total FROM DailyStat s " +
           "WHERE s.id.metric = :metric AND s.id.day >= :from AND s.id.day < :to " +
           "GROUP BY s.id.day ORDER BY s.id.day")
    List<DayTotal> seriesBetween(@Param("metric") String metric, @Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Sommes groupées par cible, triées décroissant — top outils/guides, répartition des sources. */
    @Query("SELECT s.id.target AS target, SUM(s.count) AS total FROM DailyStat s " +
           "WHERE s.id.metric = :metric AND s.id.day >= :from AND s.id.day < :to " +
           "GROUP BY s.id.target ORDER BY SUM(s.count) DESC")
    List<TargetTotal> topTargetsBetween(@Param("metric") String metric,
                                        @Param("from") LocalDate from,
                                        @Param("to") LocalDate to,
                                        Pageable pageable);

    @Modifying
    @Query("DELETE FROM DailyStat s WHERE s.id.day < :before")
    int deleteByDayBefore(@Param("before") LocalDate before);

    interface DayTotal {
        LocalDate getDay();
        long getTotal();
    }

    interface TargetTotal {
        String getTarget();
        long getTotal();
    }
}
