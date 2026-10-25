package be.freenote.integration;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** En-têtes et réponses que voit un visiteur anonyme, sur la vraie chaîne de filtres. */
@Tag("integration")
class SecurityHeadersTest extends AbstractIntegrationTest {

    /** Aucun script tiers : un joker comme *.google.com ouvrirait un contournement par JSONP. */
    @Test
    void laCspNAutoriseAucunScriptTiers() throws Exception {
        mockMvc.perform(get("/api/stats"))
                .andExpect(header().string("Content-Security-Policy",
                        containsString("script-src 'self' 'wasm-unsafe-eval';")))
                .andExpect(header().string("Content-Security-Policy", containsString("object-src 'none'")))
                .andExpect(header().string("Content-Security-Policy", not(containsString("*.google.com"))))
                .andExpect(header().string("Content-Security-Policy", not(containsString("googlesyndication"))))
                .andExpect(header().string("Content-Security-Policy", not(containsString("doubleclick"))));
    }

    @Test
    void unAppelDirectAErrorNEstPasUnePanne() throws Exception {
        mockMvc.perform(get("/error")).andExpect(status().isNotFound());
    }
}
