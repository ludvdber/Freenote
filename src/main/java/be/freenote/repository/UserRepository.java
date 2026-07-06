package be.freenote.repository;

import be.freenote.entity.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmailHash(String emailHash);
    Optional<User> findByUsername(String username);
    boolean existsByUsername(String username);
    List<User> findAllByOrderByXpDesc(Pageable pageable);

    /** Number of users strictly above the given XP — used to derive a 1-based leaderboard rank
     *  (rank = countByXpGreaterThan(xp) + 1) without loading the whole leaderboard. */
    long countByXpGreaterThan(int xp);

    @Query("SELECT u FROM User u JOIN u.profile p WHERE p.section.id = :sectionId ORDER BY u.xp DESC")
    List<User> findBySectionOrderByXpDesc(Long sectionId, Pageable pageable);

    /** Profils du carrousel d'accueil : JOIN FETCH (le mapper lit profile → sans FETCH, N+1) et
     *  Pageable (la liste opt-in grossit avec les inscrits — jamais la table entière). */
    @Query("SELECT u FROM User u JOIN FETCH u.profile p WHERE p.showInCarousel = true ORDER BY u.xp DESC")
    List<User> findFeaturedProfiles(Pageable pageable);

    /** Colonne trusted seule — évite de charger l'entité User complète à chaque appel rate-limité. */
    @Query("SELECT u.trusted FROM User u WHERE u.id = :id")
    Optional<Boolean> findTrustedById(Long id);

    @Query("SELECT u FROM User u WHERE LOWER(u.username) LIKE LOWER(CONCAT('%', :q, '%')) ORDER BY u.username")
    List<User> searchByUsername(String q, Pageable pageable);

    @Query("""
        SELECT u FROM User u JOIN u.profile p
        WHERE p.section.id = :sectionId
          AND LOWER(u.username) LIKE LOWER(CONCAT('%', :q, '%'))
        ORDER BY u.username
        """)
    List<User> searchByUsernameAndSection(String q, Long sectionId, Pageable pageable);
}
