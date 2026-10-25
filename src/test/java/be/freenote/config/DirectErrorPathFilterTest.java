package be.freenote.config;

import jakarta.servlet.DispatcherType;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class DirectErrorPathFilterTest {

    private final DirectErrorPathFilter filter = new DirectErrorPathFilter();

    @Test
    void unAppelDirectAErrorRepond404() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/error");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(404);
        assertThat(response.getContentAsString()).contains("Endpoint not found");
        assertThat(chain.getRequest()).as("le contrôleur d'erreur n'est pas atteint").isNull();
    }

    @Test
    void uneVraieErreurAtteintToujoursLeControleurDErreur() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/error");
        // Ce que pose Tomcat lors du renvoi interne vers /error après une vraie erreur.
        request.setDispatcherType(DispatcherType.ERROR);
        request.setAttribute("jakarta.servlet.error.request_uri", "/api/documents/1");
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, new MockHttpServletResponse(), chain);

        assertThat(chain.getRequest()).isSameAs(request);
    }

    @Test
    void lesAutresAdressesNeSontPasTouchees() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/stats");
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, new MockHttpServletResponse(), chain);

        assertThat(chain.getRequest()).isSameAs(request);
    }
}
