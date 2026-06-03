package be.freenote.controller;

import be.freenote.dto.response.DocumentResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.security.AdminRoleVerificationFilter;
import be.freenote.security.JwtAuthFilter;
import be.freenote.service.DocumentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(DocumentController.class)
@AutoConfigureMockMvc(addFilters = false)
@ImportAutoConfiguration(exclude = OAuth2ClientWebSecurityAutoConfiguration.class)
class DocumentControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockitoBean private DocumentService documentService;
    @MockitoBean private JwtAuthFilter jwtAuthFilter;
    @MockitoBean private AdminRoleVerificationFilter adminRoleVerificationFilter;

    private static final DocumentResponse DOC = new DocumentResponse(
            1L, "Test Doc", 1L, "Java", "Info", "SYNTHESE", "Alice", 7L,
            true, false, "FR", "2025", null, 4.5, 10,
            LocalDateTime.now()
    );

    @Test
    void getById_shouldReturnDocument() throws Exception {
        when(documentService.getById(1L)).thenReturn(DOC);

        mockMvc.perform(get("/api/documents/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Test Doc"))
                .andExpect(jsonPath("$.category").value("SYNTHESE"));
    }

    @Test
    void search_shouldReturnPagedResults() throws Exception {
        when(documentService.search(any(), any(), any(), any(), any(), any()))
                .thenReturn(new PageResponse<>(List.of(DOC), 0, 20, 1, 1));

        mockMvc.perform(get("/api/documents/search").param("q", "java"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].title").value("Test Doc"))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void popular_shouldReturnList() throws Exception {
        when(documentService.getPopular(null)).thenReturn(List.of(DOC));

        mockMvc.perform(get("/api/documents/popular"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].downloadCount").value(10));
    }

    @Test
    void getById_shouldReturn404WhenNotFound() throws Exception {
        when(documentService.getById(999L))
                .thenThrow(new ResourceNotFoundException("Document", "id", 999L));

        mockMvc.perform(get("/api/documents/999"))
                .andExpect(status().isNotFound());
    }
}
