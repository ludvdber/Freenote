package be.freenote.integration;

import be.freenote.dto.response.AdminUserSupportResponse;
import be.freenote.dto.response.SystemStatusResponse;
import be.freenote.entity.User;
import be.freenote.repository.UserRepository;
import be.freenote.service.AdminSystemService;
import be.freenote.service.AdminUserSupportService;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Fiche support et pane Système sur les vrais services : le SCAN Redis des limites d'un compte ne
 * doit remonter que les SIENNES (pas celles d'un id qui commence pareil), et chaque sonde du pane
 * Système doit répondre face aux vrais conteneurs.
 */
@Tag("integration")
class AdminSupportFlowTest extends AbstractIntegrationTest {

    @Autowired private UserRepository userRepository;
    @Autowired private AdminUserSupportService supportService;
    @Autowired private AdminSystemService systemService;
    @Autowired private StringRedisTemplate redis;

    @Test
    void limitesEtCodeDUnSeulCompte() {
        User user = userRepository.save(User.builder().username("sup-" + UUID.randomUUID().toString().substring(0, 8)).build());
        long id = user.getId();
        redis.opsForValue().set("verify:" + id, "123456:hash", Duration.ofMinutes(15));
        redis.opsForValue().set("verify-attempts:" + id, "2", Duration.ofMinutes(15));
        redis.opsForValue().set("rate:AuthController.requestVerification(..):user:" + id, "3", Duration.ofHours(1));
        // Même préfixe d'id : ne doit ni apparaître ni être effacé.
        String other = "rate:AuthController.requestVerification(..):user:" + id + "0";
        redis.opsForValue().set(other, "1", Duration.ofHours(1));

        AdminUserSupportResponse r = supportService.get(id);
        assertThat(r.pendingCode()).isNotNull();
        assertThat(r.pendingCode().attempts()).isEqualTo(2);
        assertThat(r.rateLimits()).extracting(AdminUserSupportResponse.ActiveRateLimit::endpoint)
                .containsExactly("AuthController.requestVerification");

        assertThat(supportService.clearRateLimits(id)).isEqualTo(1);
        assertThat(redis.hasKey(other)).isTrue();
        supportService.cancelCode(id);
        assertThat(supportService.get(id).pendingCode()).isNull();
        assertThat(supportService.get(id).rateLimits()).isEmpty();
    }

    @Test
    void toutesLesSondesRepondent() {
        SystemStatusResponse s = systemService.status();

        assertThat(s.services()).allSatisfy(p -> assertThat(p.up()).as(p.name()).isTrue());
        assertThat(s.indexedDocuments()).isNotNull();
    }
}
