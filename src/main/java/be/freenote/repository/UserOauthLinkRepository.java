package be.freenote.repository;

import be.freenote.entity.User;
import be.freenote.entity.UserOauthLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserOauthLinkRepository extends JpaRepository<UserOauthLink, Long> {
    Optional<UserOauthLink> findByProviderAndOauthId(String provider, String oauthId);
    /** Used by {@code UserServiceImpl.banUser} to blacklist every Discord identity of an account. */
    List<UserOauthLink> findByUserId(Long userId);

    /** Resolves the linked User eagerly (JOIN FETCH) so callers outside a transaction —
     *  e.g. OAuth2LoginSuccessHandler generating the JWT — can read its fields without
     *  hitting a LazyInitializationException on the lazy user proxy. */
    @Query("SELECT l.user FROM UserOauthLink l WHERE l.provider = :provider AND l.oauthId = :oauthId")
    Optional<User> findUserByProviderAndOauthId(String provider, String oauthId);
}
