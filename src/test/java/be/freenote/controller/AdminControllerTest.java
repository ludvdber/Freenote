package be.freenote.controller;

import be.freenote.dto.response.SectionResponse;
import be.freenote.security.AdminRoleVerificationFilter;
import be.freenote.security.JwtAuthFilter;
import be.freenote.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminController.class)
@AutoConfigureMockMvc(addFilters = false)
@ImportAutoConfiguration(exclude = OAuth2ClientWebSecurityAutoConfiguration.class)
class AdminControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockitoBean private DocumentService documentService;
    @MockitoBean private CourseService courseService;
    @MockitoBean private ProfessorService professorService;
    @MockitoBean private ReportService reportService;
    @MockitoBean private SectionService sectionService;
    @MockitoBean private UserService userService;
    @MockitoBean private DonationService donationService;
    @MockitoBean private SmtpKeepAliveService smtpKeepAliveService;
    @MockitoBean private JwtAuthFilter jwtAuthFilter;
    @MockitoBean private AdminRoleVerificationFilter adminRoleVerificationFilter;

    @Test
    void pendingDocuments_shouldCallService() throws Exception {
        when(documentService.getUnverified()).thenReturn(List.of());

        mockMvc.perform(get("/api/admin/documents/pending"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void createSection_shouldReturn201() throws Exception {
        when(sectionService.create("Test", null))
                .thenReturn(new SectionResponse(1L, "Test", null, 0, true));

        mockMvc.perform(post("/api/admin/sections").param("name", "Test"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Test"));
    }

    @Test
    void approveSection_shouldCallService() throws Exception {
        when(sectionService.approve(1L))
                .thenReturn(new SectionResponse(1L, "Test", null, 0, true));

        mockMvc.perform(put("/api/admin/sections/1/approve"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Test"));
    }
}
