package be.freenote.integration;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.net.URI;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Visiteur anonyme, aucun cookie. Avant le correctif du 2026-10-25, la règle permitAll du shell SPA
 * comparait l'adresse BRUTE : « /%61pi/… » ne commence pas par « /api/ », passait donc pour une
 * route React, puis Spring la décodait en /api/… et servait le contrôleur sans authentification
 * (constaté en prod sur /%61pi/leaderboard : 200 au lieu de 401).
 */
@Tag("integration")
class EncodedPathBypassTest extends AbstractIntegrationTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "/%61pi/leaderboard?size=1",
            "/%61pi/documents/1/file",
            "/%61pi/documents/search",
            "/%61pi/admin/users?q=a",
            "/%61pi/%61dmin/activity-logs",
            "/api/%61dmin/system"
    })
    void uneAdresseEncodeeNOuvrePasLApi(String path) throws Exception {
        mockMvc.perform(get(URI.create(path))).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @ValueSource(strings = {"/%61ctuator/metrics", "/%61ctuator/env"})
    void niActuator(String path) throws Exception {
        mockMvc.perform(get(URI.create(path))).andExpect(status().isUnauthorized());
    }
}
