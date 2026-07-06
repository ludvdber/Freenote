package be.freenote.controller;

import be.freenote.dto.response.StatsResponse;
import be.freenote.security.AdminRoleVerificationFilter;
import be.freenote.security.JwtAuthFilter;
import be.freenote.service.StatsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(StatsController.class)
@AutoConfigureMockMvc(addFilters = false)
@ImportAutoConfiguration(exclude = OAuth2ClientWebSecurityAutoConfiguration.class)
class StatsControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockitoBean private StatsService statsService;
    @MockitoBean private JwtAuthFilter jwtAuthFilter;
    @MockitoBean private AdminRoleVerificationFilter adminRoleVerificationFilter;

    @Test
    void getStats_shouldReturnData() throws Exception {
        when(statsService.getStats()).thenReturn(new StatsResponse(42, 500, 15, 8, 5, java.util.List.of()));

        mockMvc.perform(get("/api/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalDocs").value(42))
                .andExpect(jsonPath("$.weekUploads").value(5));
    }
}
