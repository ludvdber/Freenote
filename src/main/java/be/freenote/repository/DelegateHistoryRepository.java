package be.freenote.repository;

import be.freenote.entity.DelegateHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DelegateHistoryRepository extends JpaRepository<DelegateHistory, Long> {
    List<DelegateHistory> findByEndDateIsNull();
    /** Ended mandates (former delegates), most recently ended first. */
    List<DelegateHistory> findByEndDateIsNotNullOrderByEndDateDesc();
    List<DelegateHistory> findByUserId(Long userId);
    Optional<DelegateHistory> findByUserIdAndEndDateIsNull(Long userId);

    /** Batch (anti-N+1) : ids des users ayant un mandat EN COURS parmi la liste donnée. */
    @Query("SELECT DISTINCT dh.user.id FROM DelegateHistory dh WHERE dh.user.id IN :ids AND dh.endDate IS NULL")
    List<Long> findActiveDelegateUserIds(@Param("ids") List<Long> ids);

    /** Batch (anti-N+1) : ids des users ayant DÉJÀ eu un mandat (en cours ou terminé). */
    @Query("SELECT DISTINCT dh.user.id FROM DelegateHistory dh WHERE dh.user.id IN :ids")
    List<Long> findAnyDelegateUserIds(@Param("ids") List<Long> ids);
}
