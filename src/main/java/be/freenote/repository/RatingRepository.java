package be.freenote.repository;

import be.freenote.entity.Rating;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RatingRepository extends JpaRepository<Rating, Long> {

    Optional<Rating> findByDocumentIdAndUserId(Long documentId, Long userId);

    /** Scores d'un document — capturés avant sa suppression pour reprendre l'XP correspondant. */
    @Query("SELECT r.score FROM Rating r WHERE r.document.id = :documentId")
    List<Integer> findScoresByDocumentId(@Param("documentId") Long documentId);

    /** Moyenne des notes reçues sur TOUS les documents d'un auteur (tuiles profil) — null si aucun vote. */
    @Query("SELECT AVG(r.score) FROM Rating r WHERE r.document.user.id = :userId")
    Double avgScoreReceivedByUserId(@Param("userId") Long userId);
}
