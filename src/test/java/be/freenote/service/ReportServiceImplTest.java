package be.freenote.service;

import be.freenote.dto.request.ReportRequest;
import be.freenote.dto.request.ResolveReportRequest;
import be.freenote.dto.request.UpdateDocumentRequest;
import be.freenote.entity.Document;
import be.freenote.entity.Report;
import be.freenote.entity.User;
import be.freenote.enums.Category;
import be.freenote.enums.ReportResolution;
import be.freenote.enums.ReportStatus;
import be.freenote.enums.ReportType;
import be.freenote.exception.ForbiddenException;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.mapper.ReportMapper;
import be.freenote.repository.DocumentRepository;
import be.freenote.repository.ReportRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.impl.ReportServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReportServiceImplTest {

    @Mock private ReportRepository reportRepository;
    @Mock private DocumentRepository documentRepository;
    @Mock private UserRepository userRepository;
    @Mock private ReportMapper reportMapper;
    @Mock private DocumentService documentService;
    @Mock private NotificationService notificationService;

    @InjectMocks private ReportServiceImpl reportService;

    private static User user(long id, String name) {
        return User.builder().id(id).username(name).build();
    }

    private static Document doc(long id, User author, boolean verified) {
        return Document.builder().id(id).title("Doc").category(Category.SYNTHESE)
                .fileKey("k").fileSize(100L).user(author).verified(verified).build();
    }

    private static ResolveReportRequest decision(ReportResolution resolution, String note) {
        ResolveReportRequest req = new ResolveReportRequest();
        req.setResolution(resolution == null ? null : resolution.name());
        req.setNote(note);
        return req;
    }

    // --- Création ---

    @Test
    void shouldCreateReportWithChosenType() {
        User reporter = user(1L, "reporter");
        Document document = doc(100L, user(7L, "author"), true);

        when(userRepository.findById(1L)).thenReturn(Optional.of(reporter));
        when(documentRepository.findById(100L)).thenReturn(Optional.of(document));

        ReportRequest req = new ReportRequest();
        req.setType("OBSOLETE");
        req.setReason("Plus au programme depuis 2024");

        reportService.create(1L, 100L, req);

        ArgumentCaptor<Report> captor = ArgumentCaptor.forClass(Report.class);
        verify(reportRepository).save(captor.capture());
        assertThat(captor.getValue().getType()).isEqualTo(ReportType.OBSOLETE);
        assertThat(captor.getValue().getReason()).isEqualTo("Plus au programme depuis 2024");
        assertThat(captor.getValue().getDocument()).isEqualTo(document);
        assertThat(captor.getValue().getUser()).isEqualTo(reporter);
    }

    @Test
    void shouldFallBackToAutreWhenTypeIsUnknown() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user(1L, "reporter")));
        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc(100L, user(7L, "a"), true)));

        ReportRequest req = new ReportRequest();
        req.setType("n-importe-quoi");
        req.setReason("hm");

        reportService.create(1L, 100L, req);

        ArgumentCaptor<Report> captor = ArgumentCaptor.forClass(Report.class);
        verify(reportRepository).save(captor.capture());
        assertThat(captor.getValue().getType()).isEqualTo(ReportType.AUTRE);
    }

    @Test
    void shouldRefuseReportingOwnDocument() {
        User author = user(1L, "author");
        when(userRepository.findById(1L)).thenReturn(Optional.of(author));
        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc(100L, author, true)));

        ReportRequest req = new ReportRequest();
        req.setReason("test");

        assertThatThrownBy(() -> reportService.create(1L, 100L, req))
                .isInstanceOf(ForbiddenException.class);
        verify(reportRepository, never()).save(any());
    }

    @Test
    void shouldThrowWhenReportingNonExistentDocument() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user(1L, "r")));
        when(documentRepository.findById(999L)).thenReturn(Optional.empty());

        ReportRequest req = new ReportRequest();
        req.setReason("test");

        assertThatThrownBy(() -> reportService.create(1L, 999L, req))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // --- Décisions ---

    /** NO_ACTION : on trace la décision et on prévient, sans toucher au document. */
    @Test
    void shouldRecordDecisionAndNotifyReporter() {
        User reporter = user(3L, "reporter");
        User admin = user(9L, "admin");
        Report report = Report.builder().id(1L).status(ReportStatus.PENDING).reason("r")
                .type(ReportType.AUTRE).user(reporter).document(doc(100L, user(7L, "author"), true)).build();

        when(reportRepository.findById(1L)).thenReturn(Optional.of(report));
        when(userRepository.findById(9L)).thenReturn(Optional.of(admin));
        when(reportRepository.findByDocumentIdAndStatus(100L, ReportStatus.PENDING)).thenReturn(List.of(report));

        reportService.decide(1L, 9L, decision(ReportResolution.NO_ACTION, "Doc déjà à jour"));

        assertThat(report.getStatus()).isEqualTo(ReportStatus.RESOLVED);
        assertThat(report.getResolution()).isEqualTo(ReportResolution.NO_ACTION);
        assertThat(report.getResolutionNote()).isEqualTo("Doc déjà à jour");
        assertThat(report.getResolvedBy()).isEqualTo(admin);
        assertThat(report.getResolvedAt()).isNotNull();
        verify(notificationService).push(eq(3L), eq("report.resolved"), anyMap());
        verify(documentService, never()).adminDelete(anyLong());
        verify(documentService, never()).adminUpdate(anyLong(), any());
    }

    /** UNVERIFIED : le document perd RÉELLEMENT sa vérification (et l'auteur est prévenu). */
    @Test
    void shouldUnverifyDocumentWhenResolutionSaysSo() {
        User reporter = user(3L, "reporter");
        Report report = Report.builder().id(1L).status(ReportStatus.PENDING).reason("r")
                .type(ReportType.ERREUR).user(reporter).document(doc(100L, user(7L, "author"), true)).build();

        when(reportRepository.findById(1L)).thenReturn(Optional.of(report));
        when(reportRepository.findByDocumentIdAndStatus(100L, ReportStatus.PENDING)).thenReturn(List.of(report));

        reportService.decide(1L, null, decision(ReportResolution.UNVERIFIED, null));

        ArgumentCaptor<UpdateDocumentRequest> captor = ArgumentCaptor.forClass(UpdateDocumentRequest.class);
        verify(documentService).adminUpdate(eq(100L), captor.capture());
        assertThat(captor.getValue().getVerified()).isFalse();
        verify(notificationService).push(eq(7L), eq("document.unverifiedByStaff"), anyMap());
        verify(notificationService).push(eq(3L), eq("report.resolved"), anyMap());
    }

    /** DELETED : le document part pour de bon, et TOUS ses signaleurs sont prévenus avant la cascade. */
    @Test
    void shouldDeleteDocumentAndNotifyEveryReporter() {
        Document document = doc(100L, user(7L, "author"), true);
        Report first = Report.builder().id(1L).status(ReportStatus.PENDING).reason("r1")
                .type(ReportType.SUPPRESSION).user(user(3L, "alice")).document(document).build();
        Report second = Report.builder().id(2L).status(ReportStatus.PENDING).reason("r2")
                .type(ReportType.SUPPRESSION).user(user(4L, "bob")).document(document).build();

        when(reportRepository.findById(1L)).thenReturn(Optional.of(first));
        when(reportRepository.findByDocumentIdAndStatus(100L, ReportStatus.PENDING))
                .thenReturn(List.of(first, second));

        reportService.decide(1L, null, decision(ReportResolution.DELETED, "Droits d'auteur"));

        // Le second signalement du même document est tranché lui aussi — il ne revient pas en file.
        assertThat(second.getStatus()).isEqualTo(ReportStatus.RESOLVED);
        assertThat(second.getResolution()).isEqualTo(ReportResolution.DELETED);
        verify(documentService).adminDelete(100L);
        verify(notificationService).push(eq(3L), eq("report.resolved"), anyMap());
        verify(notificationService).push(eq(4L), eq("report.resolved"), anyMap());
        verify(notificationService).push(eq(7L), eq("document.deletedByStaff"), anyMap());
    }

    @Test
    void shouldDismissWithRejectedResolution() {
        Report report = Report.builder().id(1L).status(ReportStatus.PENDING).reason("r")
                .type(ReportType.AUTRE).user(user(3L, "reporter")).document(doc(100L, user(7L, "a"), true)).build();

        when(reportRepository.findById(1L)).thenReturn(Optional.of(report));
        when(reportRepository.findByDocumentIdAndStatus(100L, ReportStatus.PENDING)).thenReturn(List.of(report));

        reportService.decide(1L, null, decision(ReportResolution.REJECTED, "Rien d'anormal"));

        assertThat(report.getStatus()).isEqualTo(ReportStatus.DISMISSED);
        assertThat(report.getResolution()).isEqualTo(ReportResolution.REJECTED);
        verify(notificationService).push(eq(3L), eq("report.dismissed"), anyMap());
        verify(documentService, never()).adminDelete(anyLong());
    }

    /** Une notification qui échoue ne doit pas annuler une décision déjà prise. */
    @Test
    void shouldSurviveNotificationFailure() {
        Report report = Report.builder().id(1L).status(ReportStatus.PENDING).reason("r")
                .type(ReportType.AUTRE).user(user(3L, "reporter")).document(doc(100L, user(7L, "a"), true)).build();

        when(reportRepository.findById(1L)).thenReturn(Optional.of(report));
        when(reportRepository.findByDocumentIdAndStatus(100L, ReportStatus.PENDING)).thenReturn(List.of(report));
        doThrow(new IllegalStateException("SSE down"))
                .when(notificationService).push(anyLong(), anyString(), anyMap());

        reportService.decide(1L, null, decision(ReportResolution.NO_ACTION, null));

        assertThat(report.getStatus()).isEqualTo(ReportStatus.RESOLVED);
    }

    /** Document déjà anonymisé (compte supprimé) : plus personne à prévenir côté auteur. */
    @Test
    void shouldNotNotifyAuthorOfAnOrphanedDocument() {
        Document orphan = doc(100L, null, true);
        Report report = Report.builder().id(1L).status(ReportStatus.PENDING).reason("r")
                .type(ReportType.SUPPRESSION).user(user(3L, "reporter")).document(orphan).build();

        when(reportRepository.findById(1L)).thenReturn(Optional.of(report));
        when(reportRepository.findByDocumentIdAndStatus(100L, ReportStatus.PENDING)).thenReturn(List.of(report));

        reportService.decide(1L, null, decision(ReportResolution.DELETED, null));

        verify(documentService).adminDelete(100L);
        verify(notificationService).push(eq(3L), eq("report.resolved"), anyMap());
        verify(notificationService, never()).push(eq(7L), anyString(), anyMap());
    }

    /** Signaleur détaché (compte supprimé, user_id ON DELETE SET NULL) : rien à notifier. */
    @Test
    void shouldSurviveAReportWithoutReporter() {
        Report report = Report.builder().id(1L).status(ReportStatus.PENDING).reason("r")
                .type(ReportType.AUTRE).user(null).document(doc(100L, user(7L, "author"), true)).build();

        when(reportRepository.findById(1L)).thenReturn(Optional.of(report));
        when(reportRepository.findByDocumentIdAndStatus(100L, ReportStatus.PENDING)).thenReturn(List.of(report));

        reportService.decide(1L, null, decision(ReportResolution.NO_ACTION, null));

        assertThat(report.getStatus()).isEqualTo(ReportStatus.RESOLVED);
        verify(notificationService, never()).push(anyLong(), anyString(), anyMap());
    }

    /** Un document DÉJÀ non vérifié : on trace la décision sans repasser par adminUpdate. */
    @Test
    void shouldNotUnverifyAnAlreadyUnverifiedDocument() {
        Report report = Report.builder().id(1L).status(ReportStatus.PENDING).reason("r")
                .type(ReportType.ERREUR).user(user(3L, "reporter"))
                .document(doc(100L, user(7L, "author"), false)).build();

        when(reportRepository.findById(1L)).thenReturn(Optional.of(report));
        when(reportRepository.findByDocumentIdAndStatus(100L, ReportStatus.PENDING)).thenReturn(List.of(report));

        reportService.decide(1L, null, decision(ReportResolution.UNVERIFIED, null));

        verify(documentService, never()).adminUpdate(anyLong(), any());
        verify(notificationService).push(eq(7L), eq("document.unverifiedByStaff"), anyMap());
    }

    /** Un signalement déjà traité qu'on re-tranche reste couvert (il n'est plus dans la file). */
    @Test
    void shouldCoverAReportThatIsNoLongerPending() {
        Report report = Report.builder().id(1L).status(ReportStatus.RESOLVED).reason("r")
                .type(ReportType.AUTRE).user(user(3L, "reporter"))
                .document(doc(100L, user(7L, "author"), true)).build();

        when(reportRepository.findById(1L)).thenReturn(Optional.of(report));
        when(reportRepository.findByDocumentIdAndStatus(100L, ReportStatus.PENDING)).thenReturn(List.of());

        reportService.decide(1L, null, decision(ReportResolution.REJECTED, null));

        assertThat(report.getStatus()).isEqualTo(ReportStatus.DISMISSED);
    }

    @Test
    void shouldRejectAnUnknownResolution() {
        Report report = Report.builder().id(1L).status(ReportStatus.PENDING).reason("r")
                .type(ReportType.AUTRE).document(doc(100L, user(7L, "a"), true)).build();
        when(reportRepository.findById(1L)).thenReturn(Optional.of(report));
        ResolveReportRequest bad = new ResolveReportRequest();
        bad.setResolution("N_IMPORTE_QUOI");

        assertThatThrownBy(() -> reportService.decide(1L, null, bad))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /** Corps sans résolution : « rien à changer » par défaut, jamais une erreur. */
    @Test
    void shouldDefaultToNoActionWhenResolutionIsAbsent() {
        Report report = Report.builder().id(1L).status(ReportStatus.PENDING).reason("r")
                .type(ReportType.AUTRE).user(user(3L, "reporter"))
                .document(doc(100L, user(7L, "a"), true)).build();
        when(reportRepository.findById(1L)).thenReturn(Optional.of(report));
        when(reportRepository.findByDocumentIdAndStatus(100L, ReportStatus.PENDING)).thenReturn(List.of(report));

        reportService.decide(1L, null, decision(null, "   "));

        assertThat(report.getResolution()).isEqualTo(ReportResolution.NO_ACTION);
        // Une note vide n'est pas stockée : elle serait affichée comme « — «  » » côté panel.
        assertThat(report.getResolutionNote()).isNull();
    }

    @Test
    void shouldThrowWhenDecidingOnNonExistentReport() {
        when(reportRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reportService.decide(999L, null, decision(ReportResolution.NO_ACTION, null)))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // --- Compteurs ---

    @Test
    void shouldReturnZeroForEveryTypeWithNoPendingReports() {
        when(reportRepository.countByTypeGrouped(ReportStatus.PENDING)).thenReturn(List.of());

        Map<String, Long> counts = reportService.pendingCountsByType();

        assertThat(counts).hasSize(ReportType.values().length);
        assertThat(counts.values()).allMatch(v -> v == 0L);
    }

    @Test
    void shouldCountPendingReportsByType() {
        when(reportRepository.countByTypeGrouped(ReportStatus.PENDING))
                .thenReturn(List.of(new Object[]{ReportType.SUPPRESSION, 2L}, new Object[]{ReportType.OBSOLETE, 5L}));

        Map<String, Long> counts = reportService.pendingCountsByType();

        assertThat(counts).containsEntry("SUPPRESSION", 2L).containsEntry("OBSOLETE", 5L)
                .containsEntry("AUTRE", 0L);
    }
}
