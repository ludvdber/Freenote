package be.freenote.controller;

import be.freenote.dto.request.ResolveReportRequest;
import be.freenote.dto.request.UpdateDocumentRequest;
import be.freenote.dto.response.*;
import be.freenote.enums.ReportStatus;
import be.freenote.enums.ReportType;
import be.freenote.security.AdminRoleVerificationFilter;
import be.freenote.security.JwtAuthFilter;
import be.freenote.service.*;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Tranche web du panel admin : ce qui compte ici n'est pas la logique métier (testée dans les
 * services) mais le <b>contrat HTTP</b> — chemin, méthode, code de retour, et surtout les
 * garde-fous qui vivent dans le contrôleur lui-même : l'anti-auto-verrouillage (un admin ne peut
 * ni se bannir, ni se supprimer, ni se rétrograder) et la tolérance des filtres de la file de
 * signalements.
 */
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
    @MockitoBean private ActivityLogService activityLogService;
    @MockitoBean private JwtAuthFilter jwtAuthFilter;
    @MockitoBean private AdminRoleVerificationFilter adminRoleVerificationFilter;

    /**
     * Le principal est l'id Long posé par JwtAuthFilter (voir SecurityUtils). On le passe via
     * {@code .principal(...)} et non le post-processeur {@code authentication()} de
     * spring-security-test : la tranche tourne avec {@code addFilters = false}, donc rien ne
     * charge le SecurityContext — seul le principal porté par la requête est résolu.
     */
    private static UsernamePasswordAuthenticationToken as(long userId) {
        return new UsernamePasswordAuthenticationToken(userId, null, List.of());
    }

    private static <T> PageResponse<T> emptyPage() {
        return new PageResponse<>(List.of(), 0, 20, 0, 0);
    }

    private static UserResponse user(long id, String username) {
        return new UserResponse(id, username, null, false, false, 0, null, null, null, null, null,
                0L, false, false, false, true, null, "AUTO", username, null, null, false, null, null,
                false, null, null, null, false, null, false, false, false, false);
    }

    private static DocumentResponse document(long id, String title) {
        return new DocumentResponse(id, title, 1L, "Java", 2L, "Info", "SYNTHESE", "Alice", 7L,
                true, false, "FR", "2025", null, null, 0.0, 0, 0, null, false, LocalDateTime.now());
    }

    @Nested
    class Documents {

        @Test
        void listeLesDocumentsEnAttente() throws Exception {
            when(documentService.getUnverified(any())).thenReturn(emptyPage());

            mockMvc.perform(get("/api/admin/documents/pending"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content").isArray());
        }

        /** La taille de page est bornée à 100 : un `size=99999` ne doit pas vider la table. */
        @Test
        void borneLaTailleDePage() throws Exception {
            when(documentService.getUnverified(any())).thenReturn(emptyPage());

            mockMvc.perform(get("/api/admin/documents/pending").param("size", "99999"))
                    .andExpect(status().isOk());

            verify(documentService).getUnverified(argThat(p -> p.getPageSize() == 100));
        }

        @Test
        void borneAussiUneTailleOuUnePageNegative() throws Exception {
            when(documentService.getUnverified(any())).thenReturn(emptyPage());

            mockMvc.perform(get("/api/admin/documents/pending").param("page", "-5").param("size", "0"))
                    .andExpect(status().isOk());

            verify(documentService).getUnverified(argThat(p -> p.getPageNumber() == 0 && p.getPageSize() == 1));
        }

        @Test
        void listeLesGroupesDeDoublons() throws Exception {
            when(documentService.getDuplicateGroups()).thenReturn(List.of(List.of(document(1L, "A"))));

            mockMvc.perform(get("/api/admin/documents/duplicates"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0][0].title").value("A"));
        }

        @Test
        void verifieUnDocument() throws Exception {
            when(documentService.verify(3L)).thenReturn(document(3L, "Doc"));

            mockMvc.perform(put("/api/admin/documents/3/verify"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(3));
        }

        /** L'interrupteur « Vérifié » de la fiche d'édition passe par ici. */
        @Test
        void metAJourUnDocumentYComprisSaVerification() throws Exception {
            when(documentService.adminUpdate(eq(3L), any())).thenReturn(document(3L, "Corrigé"));

            mockMvc.perform(put("/api/admin/documents/3")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"Corrigé\",\"verified\":false}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.title").value("Corrigé"));

            verify(documentService).adminUpdate(eq(3L), argThat((UpdateDocumentRequest r) ->
                    "Corrigé".equals(r.getTitle()) && Boolean.FALSE.equals(r.getVerified())));
        }

        @Test
        void supprimeUnDocument() throws Exception {
            mockMvc.perform(delete("/api/admin/documents/3")).andExpect(status().isNoContent());
            verify(documentService).adminDelete(3L);
        }
    }

    @Nested
    class Signalements {

        @Test
        void listeAvecFiltresStatutEtType() throws Exception {
            when(reportService.list(any(), any(), any())).thenReturn(emptyPage());

            mockMvc.perform(get("/api/admin/reports")
                            .param("status", "PENDING").param("type", "SUPPRESSION"))
                    .andExpect(status().isOk());

            verify(reportService).list(eq(ReportStatus.PENDING), eq(ReportType.SUPPRESSION), any());
        }

        /** Filtres absents = pas de filtre : c'est ainsi qu'on lit tout l'historique. */
        @Test
        void sansFiltreListeToutLHistorique() throws Exception {
            when(reportService.list(any(), any(), any())).thenReturn(emptyPage());

            mockMvc.perform(get("/api/admin/reports")).andExpect(status().isOk());

            verify(reportService).list(isNull(), isNull(), any());
        }

        /**
         * Un filtre mal orthographié dans une URL partagée ne doit pas casser l'écran : il est
         * traité comme absent, jamais comme une erreur 400.
         */
        @Test
        void unFiltreInconnuEstIgnoreAuLieuDeRenvoyerUneErreur() throws Exception {
            when(reportService.list(any(), any(), any())).thenReturn(emptyPage());

            mockMvc.perform(get("/api/admin/reports").param("status", "n-importe-quoi").param("type", "ALL"))
                    .andExpect(status().isOk());

            verify(reportService).list(isNull(), isNull(), any());
        }

        @Test
        void compteursParType() throws Exception {
            when(reportService.pendingCountsByType()).thenReturn(Map.of("SUPPRESSION", 2L, "AUTRE", 0L));

            mockMvc.perform(get("/api/admin/reports/counts"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.SUPPRESSION").value(2));
        }

        /** Route historique conservée : elle alimente encore la file « À traiter ». */
        @Test
        void routeHeritageEnAttente() throws Exception {
            when(reportService.list(any(), any(), any())).thenReturn(emptyPage());

            mockMvc.perform(get("/api/admin/reports/pending")).andExpect(status().isOk());

            verify(reportService).list(eq(ReportStatus.PENDING), isNull(), any());
        }

        @Test
        void transmetLaDecisionEtLeModerateurQuiLaPrend() throws Exception {
            mockMvc.perform(put("/api/admin/reports/1/resolve")
                            .principal(as(9L))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"resolution\":\"UNVERIFIED\",\"note\":\"corrigé\"}"))
                    .andExpect(status().isOk());

            verify(reportService).decide(eq(1L), eq(9L), argThat((ResolveReportRequest r) ->
                    "UNVERIFIED".equals(r.getResolution()) && "corrigé".equals(r.getNote())));
        }

        /** « Rejeter » force la résolution REJECTED côté serveur, quoi qu'envoie le client. */
        @Test
        void rejeterForceLaResolutionRejected() throws Exception {
            mockMvc.perform(put("/api/admin/reports/1/dismiss")
                            .principal(as(9L))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"resolution\":\"DELETED\",\"note\":\"rien d'anormal\"}"))
                    .andExpect(status().isOk());

            verify(reportService).decide(eq(1L), eq(9L), argThat((ResolveReportRequest r) ->
                    "REJECTED".equals(r.getResolution())));
        }

        /** Corps absent : décision par défaut plutôt qu'un 400 sur un bouton qui n'envoie rien. */
        @Test
        void accepteUneDecisionSansCorps() throws Exception {
            mockMvc.perform(put("/api/admin/reports/1/dismiss").principal(as(9L)))
                    .andExpect(status().isOk());

            verify(reportService).decide(eq(1L), eq(9L), any());
        }
    }

    @Nested
    class Catalogue {

        @Test
        void creeUneSection() throws Exception {
            when(sectionService.create("Test", null))
                    .thenReturn(new SectionResponse(1L, "Test", null, 0, true));

            mockMvc.perform(post("/api/admin/sections").param("name", "Test"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.name").value("Test"));
        }

        @Test
        void approuveUneSection() throws Exception {
            when(sectionService.approve(1L)).thenReturn(new SectionResponse(1L, "Test", null, 0, true));

            mockMvc.perform(put("/api/admin/sections/1/approve"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("Test"));
        }

        @Test
        void listeEtSupprimeLesSections() throws Exception {
            when(sectionService.getAllForAdmin()).thenReturn(List.of());

            mockMvc.perform(get("/api/admin/sections")).andExpect(status().isOk());
            mockMvc.perform(delete("/api/admin/sections/1")).andExpect(status().isNoContent());
            verify(sectionService).adminDelete(1L);
        }

        @Test
        void listeRenommeEtSupprimeLesCours() throws Exception {
            when(courseService.getAllForAdmin()).thenReturn(List.of());
            when(courseService.rename(eq(1L), eq("Nouveau")))
                    .thenReturn(new CourseResponse(1L, "Nouveau", 1L, "Info", 0, true, null));

            mockMvc.perform(get("/api/admin/courses")).andExpect(status().isOk());
            mockMvc.perform(patch("/api/admin/courses/1").param("name", "Nouveau"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("Nouveau"));
            mockMvc.perform(delete("/api/admin/courses/1")).andExpect(status().isNoContent());
        }

        /** Le corps du PUT est la liste EXACTE des équivalents — vide = délier (V15). */
        @Test
        void ecritLesEquivalencesDeCours() throws Exception {
            when(courseService.setEquivalents(eq(1L), anyList())).thenReturn(List.of());

            mockMvc.perform(put("/api/admin/courses/1/equivalents")
                            .contentType(MediaType.APPLICATION_JSON).content("[2,3]"))
                    .andExpect(status().isOk());

            verify(courseService).setEquivalents(1L, List.of(2L, 3L));
        }

        @Test
        void listeEtSupprimeLesProfesseurs() throws Exception {
            when(professorService.getAllForAdmin()).thenReturn(List.of());

            mockMvc.perform(get("/api/admin/professors")).andExpect(status().isOk());
            mockMvc.perform(delete("/api/admin/professors/1")).andExpect(status().isNoContent());
            verify(professorService).delete(1L);
        }
    }

    @Nested
    class Utilisateurs {

        @Test
        void rechercheAvecFiltres() throws Exception {
            when(userService.adminSearchUsers(any(), any(), anyInt())).thenReturn(List.of(user(1L, "alice")));

            mockMvc.perform(get("/api/admin/users").param("q", "ali").param("sectionId", "2"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].username").value("alice"));

            verify(userService).adminSearchUsers("ali", 2L, 30);
        }

        @Test
        void basculeLesDroitsStaffEtDeConfiance() throws Exception {
            when(userService.adminSetModerator(anyLong(), anyBoolean())).thenReturn(user(2L, "bob"));
            when(userService.adminSetEditor(anyLong(), anyBoolean())).thenReturn(user(2L, "bob"));
            when(userService.adminSetTrusted(anyLong(), anyBoolean())).thenReturn(user(2L, "bob"));

            mockMvc.perform(put("/api/admin/users/2/moderator")).andExpect(status().isOk());
            mockMvc.perform(delete("/api/admin/users/2/moderator")).andExpect(status().isOk());
            mockMvc.perform(put("/api/admin/users/2/editor")).andExpect(status().isOk());
            mockMvc.perform(delete("/api/admin/users/2/editor")).andExpect(status().isOk());
            mockMvc.perform(put("/api/admin/users/2/trust")).andExpect(status().isOk());
            mockMvc.perform(put("/api/admin/users/2/untrust")).andExpect(status().isOk());

            verify(userService).adminSetModerator(2L, true);
            verify(userService).adminSetModerator(2L, false);
            verify(userService).adminSetEditor(2L, true);
            verify(userService).adminSetEditor(2L, false);
        }

        @Test
        void verifieEtDeVerifieUnCompte() throws Exception {
            when(userService.adminVerifyUser(2L)).thenReturn(user(2L, "bob"));
            when(userService.adminUnverifyUser(2L)).thenReturn(user(2L, "bob"));

            mockMvc.perform(put("/api/admin/users/2/verify")).andExpect(status().isOk());
            mockMvc.perform(put("/api/admin/users/2/unverify")).andExpect(status().isOk());
        }

        /**
         * Les trois garde-fous anti-auto-verrouillage. Sans eux, un admin qui se rétrograde ou se
         * supprime perd l'accès au panel dès la requête suivante — le filtre staff relit la base.
         */
        @Test
        void unAdminNePeutPasSeRetrograder() throws Exception {
            mockMvc.perform(patch("/api/admin/users/9/role")
                            .principal(as(9L)).param("role", "USER"))
                    .andExpect(status().isForbidden());

            verify(userService, never()).adminUpdateRole(anyLong(), anyString());
        }

        @Test
        void maisPeutRetrograderQuelquUnDAutre() throws Exception {
            when(userService.adminUpdateRole(2L, "USER")).thenReturn(user(2L, "bob"));

            mockMvc.perform(patch("/api/admin/users/2/role")
                            .principal(as(9L)).param("role", "USER"))
                    .andExpect(status().isOk());
        }

        /** Se re-promouvoir ADMIN reste permis : ce n'est pas un verrouillage. */
        @Test
        void peutSeReAttribuerAdmin() throws Exception {
            when(userService.adminUpdateRole(9L, "ADMIN")).thenReturn(user(9L, "admin"));

            mockMvc.perform(patch("/api/admin/users/9/role")
                            .principal(as(9L)).param("role", "ADMIN"))
                    .andExpect(status().isOk());
        }

        @Test
        void unAdminNePeutPasSeSupprimerParLaRouteAdmin() throws Exception {
            mockMvc.perform(delete("/api/admin/users/9").principal(as(9L)))
                    .andExpect(status().isForbidden());

            verify(userService, never()).adminDeleteUser(anyLong());
        }

        @Test
        void unAdminNePeutPasSeBannir() throws Exception {
            mockMvc.perform(post("/api/admin/users/9/ban").principal(as(9L)))
                    .andExpect(status().isForbidden());

            verify(userService, never()).banUser(anyLong(), any(), anyLong());
        }

        @Test
        void banniUnAutreCompteAvecSaRaison() throws Exception {
            mockMvc.perform(post("/api/admin/users/2/ban")
                            .principal(as(9L)).param("reason", "spam"))
                    .andExpect(status().isNoContent());

            verify(userService).banUser(2L, "spam", 9L);
        }
    }

    @Nested
    class SystemeEtDons {

        @Test
        void exposeLeStatutSmtp() throws Exception {
            when(smtpKeepAliveService.getStatus())
                    .thenReturn(new SmtpStatusResponse(123L, 12, true, 80));

            mockMvc.perform(get("/api/admin/smtp-status"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.daysSinceLastSent").value(12));
        }

        @Test
        void listeEtPurgeLeJournalDActivite() throws Exception {
            when(activityLogService.list(any(), any())).thenReturn(emptyPage());
            when(activityLogService.purgeBefore(any())).thenReturn(7);

            mockMvc.perform(get("/api/admin/activity-logs").param("type", "LOGIN"))
                    .andExpect(status().isOk());
            mockMvc.perform(delete("/api/admin/activity-logs").param("days", "90"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.deleted").value(7));
        }

        @Test
        void listeLesDons() throws Exception {
            when(donationService.listAll(any())).thenReturn(emptyPage());

            mockMvc.perform(get("/api/admin/donations")).andExpect(status().isOk());
        }

        @Test
        void supprimeUnDonDeTest() throws Exception {
            mockMvc.perform(delete("/api/admin/donations/5")).andExpect(status().isNoContent());
            verify(donationService).delete(5L);
        }
    }
}
