package be.freenote.integration;

import be.freenote.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.net.URI;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Un admin rétrogradé dont le jeton (24 h) porte encore ROLE_ADMIN, rejoué sur la vraie chaîne de
 * sécurité. Avant le correctif : 403 sur /api/admin/…, mais 200 sur /api/%61dmin/… (le filtre staff
 * comparait l'adresse brute, Spring la décode avant de router) et 200 sur /actuator/metrics (hors du
 * panel, le rôle du jeton faisait foi).
 */
@Tag("integration")
class StaffAccessFlowTest extends AbstractIntegrationTest {

    private String staleAdminJwt;

    @BeforeEach
    void setUp() {
        userRepository.findByUsername("demoted-admin").ifPresent(userRepository::delete);
        User user = createUser("demoted-admin", true, "ADMIN");
        staleAdminJwt = jwtFor(user);
        // Rétrogradation écrite directement en base : on teste le filtre, pas la révocation
        // (qui, elle, couperait le jeton avant même d'arriver ici).
        user.setRole("VERIFIED");
        userRepository.save(user);
    }

    @Test
    void unAdminRetrogradeNAtteintPlusLePanel() throws Exception {
        expectForbidden("/api/admin/analytics?days=30");
    }

    @Test
    void niParUneAdresseEncodee() throws Exception {
        expectForbidden("/api/%61dmin/analytics?days=30");
    }

    @Test
    void niActuatorHorsDuPanel() throws Exception {
        expectForbidden("/actuator/metrics");
    }

    private void expectForbidden(String path) throws Exception {
        mockMvc.perform(get(URI.create(path)).header("Authorization", "Bearer " + staleAdminJwt))
                .andExpect(status().isForbidden());
    }
}
