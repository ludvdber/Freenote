package be.freenote.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Révocation de JWT côté serveur — ce qui permet de tuer un cookie volé, ou celui d'un compte
 * banni, sans attendre les 24 h d'expiration naturelle.
 *
 * <p>Le comportement le plus délicat est le <b>fail-open</b> : si Redis tombe, on laisse passer.
 * C'est un arbitrage assumé (disponibilité du site &gt; fenêtre résiduelle d'un jeton volé) mais il
 * doit rester <i>délibéré</i> — d'où ces tests, qui empêchent qu'un refactoring le transforme en
 * fail-closed (site entièrement déconnecté à la moindre panne Redis) ou en exception non gérée.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class JwtRevocationServiceTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;

    @InjectMocks private JwtRevocationService service;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        ReflectionTestUtils.setField(service, "jwtExpirationMs", 86_400_000L);
    }

    // --- Révocation d'un jeton précis ---

    @Test
    void revoqueUnJetonAvecUnTtlEgalASaDureeRestante() {
        service.revoke("jti-1", Instant.now().plusSeconds(3600));

        verify(valueOps).set(eq("jwt-revoked:jti-1"), eq("1"), any(Duration.class));
    }

    /** Un jeton déjà expiré n'a rien à faire dans Redis : il est mort de lui-même. */
    @Test
    void nEcritRienPourUnJetonDejaExpire() {
        service.revoke("jti-1", Instant.now().minusSeconds(60));

        verify(valueOps, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    void ignoreUnIdentifiantOuUneExpirationAbsents() {
        service.revoke(null, Instant.now().plusSeconds(60));
        service.revoke("  ", Instant.now().plusSeconds(60));
        service.revoke("jti-1", null);

        verify(valueOps, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    void detecteUnJetonRevoque() {
        when(redisTemplate.hasKey("jwt-revoked:jti-1")).thenReturn(true);
        assertThat(service.isRevoked("jti-1")).isTrue();
    }

    @Test
    void unJetonInconnuNEstPasRevoque() {
        when(redisTemplate.hasKey(anyString())).thenReturn(false);
        assertThat(service.isRevoked("jti-1")).isFalse();
        assertThat(service.isRevoked(null)).isFalse();
        assertThat(service.isRevoked("   ")).isFalse();
    }

    /** Arbitrage assumé : Redis en panne ⇒ on laisse passer plutôt que de déconnecter tout le site. */
    @Test
    void laissePasserQuandRedisEstInjoignable() {
        when(redisTemplate.hasKey(anyString())).thenThrow(new QueryTimeoutException("Redis down"));

        assertThat(service.isRevoked("jti-1")).isFalse();
    }

    @Test
    void uneEcritureRatéeNeRemonteAucuneException() {
        doThrowOnSet();

        assertThatCode(() -> service.revoke("jti-1", Instant.now().plusSeconds(60)))
                .doesNotThrowAnyException();
    }

    // --- Révocation de TOUS les jetons d'un compte (bannissement, suppression) ---

    @Test
    void poseUnePointDeCoupurePourTousLesJetonsDUnCompte() {
        service.revokeAllForUser(7L);

        verify(valueOps).set(eq("jwt-revoked-user:7"), anyString(), any(Duration.class));
    }

    @Test
    void ignoreUnCompteNul() {
        service.revokeAllForUser(null);

        verify(valueOps, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    void rejetteUnJetonEmisAvantLaCoupure() {
        long cutoff = System.currentTimeMillis();
        when(valueOps.get("jwt-revoked-user:7")).thenReturn(String.valueOf(cutoff));

        assertThat(service.isUserRevoked(7L, new Date(cutoff - 1000))).isTrue();
        // Émis exactement à la coupure : rejeté aussi (comparaison inclusive).
        assertThat(service.isUserRevoked(7L, new Date(cutoff))).isTrue();
    }

    /** Un jeton ré-émis APRÈS la coupure est valide : c'est ce qui permet de se reconnecter. */
    @Test
    void accepteUnJetonEmisApresLaCoupure() {
        long cutoff = System.currentTimeMillis();
        when(valueOps.get("jwt-revoked-user:7")).thenReturn(String.valueOf(cutoff));

        assertThat(service.isUserRevoked(7L, new Date(cutoff + 1000))).isFalse();
    }

    @Test
    void aucuneCoupureEnregistreeSignifieAucuneRevocation() {
        when(valueOps.get(anyString())).thenReturn(null);

        assertThat(service.isUserRevoked(7L, new Date())).isFalse();
    }

    @Test
    void ignoreUnCompteOuUneDateAbsents() {
        assertThat(service.isUserRevoked(null, new Date())).isFalse();
        assertThat(service.isUserRevoked(7L, null)).isFalse();
        verify(valueOps, never()).get(anyString());
    }

    /** Même fail-open que pour un jeton précis, par cohérence. */
    @Test
    void laissePasserAussiQuandRedisTombeSurLaVerificationDeCompte() {
        when(valueOps.get(anyString())).thenThrow(new QueryTimeoutException("Redis down"));

        assertThat(service.isUserRevoked(7L, new Date())).isFalse();
    }

    @Test
    void uneCoupureNonEcriteNeRemontePasDException() {
        doThrowOnSet();

        assertThatCode(() -> service.revokeAllForUser(7L)).doesNotThrowAnyException();
    }

    private void doThrowOnSet() {
        org.mockito.Mockito.doThrow(new QueryTimeoutException("Redis down"))
                .when(valueOps).set(anyString(), anyString(), any(Duration.class));
    }
}
