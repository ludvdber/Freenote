package be.freenote.repository;

import be.freenote.entity.Favorite;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface FavoriteRepository extends JpaRepository<Favorite, Long> {

    /** « Mes favoris » : toutes les associations du mapper fetch-joinées (cours→section, uploader
     *  →profil, prof) — sans ça, chaque ligne de la page déclenchait ~4 SELECT paresseux (N+1). */
    @Query(value = """
        SELECT f FROM Favorite f
        JOIN FETCH f.document d
        LEFT JOIN FETCH d.course c LEFT JOIN FETCH c.section
        LEFT JOIN FETCH d.user u LEFT JOIN FETCH u.profile
        LEFT JOIN FETCH d.professor
        WHERE f.user.id = :userId
        ORDER BY f.id DESC
        """,
        countQuery = "SELECT COUNT(f) FROM Favorite f WHERE f.user.id = :userId")
    Page<Favorite> findByUserId(@Param("userId") Long userId, Pageable pageable);

    boolean existsByUserIdAndDocumentId(Long userId, Long documentId);
    void deleteByUserIdAndDocumentId(Long userId, Long documentId);
}
