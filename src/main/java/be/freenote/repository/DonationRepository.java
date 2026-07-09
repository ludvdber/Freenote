package be.freenote.repository;

import be.freenote.entity.Donation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Repository
public interface DonationRepository extends JpaRepository<Donation, Long> {
    // Sorted by id desc — donations are append-only and id is monotonic, so newest first.
    Page<Donation> findAllByOrderByIdDesc(Pageable pageable);

    /** Idempotency guard: a Ko-fi (or manual) transaction id is processed at most once. */
    boolean existsByKofiTransactionId(String kofiTransactionId);

    /** Somme des dons RATTACHÉS à un compte depuis {@code since} — alimente le thermomètre du mois.
     *  Les dons non matchés sont exclus : ce sont potentiellement des dons pour un autre projet du
     *  même compte Ko-fi (le compte est partagé) ; les grants manuels admin ont amount = 0. */
    @Query("SELECT COALESCE(SUM(d.amount), 0) FROM Donation d WHERE d.user IS NOT NULL AND d.createdAt >= :since")
    BigDecimal sumMatchedAmountSince(LocalDateTime since);

    /** Nombre de donateurs distincts du mois (dons rattachés, montant > 0 — exclut les grants
     *  manuels admin à 0 €). Motive la jauge : « N étudiants ont participé ce mois-ci ». */
    @Query("SELECT COUNT(DISTINCT d.user.id) FROM Donation d WHERE d.user IS NOT NULL AND d.amount > 0 AND d.createdAt >= :since")
    long countMatchedDonorsSince(LocalDateTime since);
}
