package be.freenote.service;

import be.freenote.dto.response.AdminOverviewResponse;
import be.freenote.dto.response.AnalyticsResponse;
import be.freenote.entity.Document;
import be.freenote.enums.ReportStatus;
import be.freenote.repository.ActivityLogRepository;
import be.freenote.repository.DailyStatRepository;
import be.freenote.repository.DocumentRepository;
import be.freenote.repository.QuizRepository;
import be.freenote.repository.ReportRepository;
import be.freenote.service.impl.AnalyticsServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceImplTest {

    @Mock private DailyStatRepository dailyStatRepository;
    @Mock private ActivityLogRepository activityLogRepository;
    @Mock private DocumentRepository documentRepository;
    @Mock private ReportRepository reportRepository;
    @Mock private QuizRepository quizRepository;

    @InjectMocks private AnalyticsServiceImpl analyticsService;

    private static DailyStatRepository.DayTotal day(LocalDate d, long total) {
        return new DailyStatRepository.DayTotal() {
            @Override public LocalDate getDay() { return d; }
            @Override public long getTotal() { return total; }
        };
    }

    private static DailyStatRepository.TargetTotal target(String t, long total) {
        return new DailyStatRepository.TargetTotal() {
            @Override public String getTarget() { return t; }
            @Override public long getTotal() { return total; }
        };
    }

    @Test
    void overviewMergesQueueCountsKpisAndAZeroFilledSeries() {
        when(documentRepository.countByVerifiedFalse()).thenReturn(3L);
        when(reportRepository.countByStatus(ReportStatus.PENDING)).thenReturn(2L);
        when(documentRepository.countDuplicateGroups()).thenReturn(1L);
        when(dailyStatRepository.sumBetween(anyString(), any(), any())).thenReturn(10L);
        when(activityLogRepository.countByTypeAndCreatedAtGreaterThanEqual(eq("SIGNUP"), any()))
                .thenReturn(5L);
        LocalDate today = LocalDate.now();
        when(dailyStatRepository.seriesBetween(eq("visit"), any(), any()))
                .thenReturn(List.of(day(today, 7)));
        when(dailyStatRepository.seriesBetween(eq("doc_view"), any(), any())).thenReturn(List.of());
        when(dailyStatRepository.seriesBetween(eq("quiz_play"), any(), any())).thenReturn(List.of());

        AdminOverviewResponse overview = analyticsService.getOverview();

        assertThat(overview.pendingDocs()).isEqualTo(3);
        assertThat(overview.pendingReports()).isEqualTo(2);
        assertThat(overview.duplicateGroups()).isEqualTo(1);
        // Série zéro-fillée : 14 jours pleins, aujourd'hui inclus, visites reportées au bon jour.
        assertThat(overview.activity14d()).hasSize(14);
        var last = overview.activity14d().get(13);
        assertThat(last.day()).isEqualTo(today);
        assertThat(last.visits()).isEqualTo(7);
        assertThat(last.docViews()).isZero();
        // Les SIGNUP sont dérivés d'activity_logs : deux COUNT (depuis from, depuis to) soustraits.
        assertThat(overview.signups7d().value()).isZero();
    }

    @Test
    void analyticsClampsTheRequestedPeriod() {
        when(dailyStatRepository.sumBetween(anyString(), any(), any())).thenReturn(0L);
        when(dailyStatRepository.seriesBetween(anyString(), any(), any())).thenReturn(List.of());
        when(dailyStatRepository.topTargetsBetween(anyString(), any(), any(), any())).thenReturn(List.of());
        when(activityLogRepository.countByTypeAndCreatedAtGreaterThanEqual(anyString(), any())).thenReturn(0L);
        when(quizRepository.findTopByAttempts(any())).thenReturn(List.of());
        when(documentRepository.findTop8ByVerifiedTrueOrderByDownloadCountDesc()).thenReturn(List.of());

        assertThat(analyticsService.getAnalytics(1000).days()).isEqualTo(365);
        assertThat(analyticsService.getAnalytics(1).days()).isEqualTo(7);
        assertThat(analyticsService.getAnalytics(30).visitsByDay()).hasSize(30);
    }

    @Test
    void analyticsMapsSourcesTopsAndDenormalizedCounters() {
        when(dailyStatRepository.sumBetween(anyString(), any(), any())).thenReturn(4L);
        when(dailyStatRepository.seriesBetween(anyString(), any(), any())).thenReturn(List.of());
        when(activityLogRepository.countByTypeAndCreatedAtGreaterThanEqual(anyString(), any())).thenReturn(0L);
        when(dailyStatRepository.topTargetsBetween(eq("visit"), any(), any(), any()))
                .thenReturn(List.of(target("organic", 12), target("direct", 5)));
        when(dailyStatRepository.topTargetsBetween(eq("tool"), any(), any(), any()))
                .thenReturn(List.of(target("quiz", 9)));
        when(dailyStatRepository.topTargetsBetween(eq("guide"), any(), any(), any()))
                .thenReturn(List.of(target("jointures-sql", 6)));
        QuizRepository.QuizTopRow topQuiz = new QuizRepository.QuizTopRow() {
            @Override public Long getId() { return 42L; }
            @Override public String getTitle() { return "Réseaux OSI"; }
            @Override public int getAttemptCount() { return 88; }
        };
        when(quizRepository.findTopByAttempts(any())).thenReturn(List.of(topQuiz));
        when(documentRepository.findTop8ByVerifiedTrueOrderByDownloadCountDesc())
                .thenReturn(List.of(Document.builder().id(7L).title("Synthèse Java").downloadCount(231).build()));

        AnalyticsResponse a = analyticsService.getAnalytics(30);

        assertThat(a.sources()).extracting(AnalyticsResponse.LabelCount::label)
                .containsExactly("organic", "direct");
        assertThat(a.topTools().get(0).label()).isEqualTo("quiz");
        assertThat(a.topGuides().get(0).count()).isEqualTo(6);
        // Les tops quiz/docs portent l'id (liens cliquables côté client) ; le tracking non.
        assertThat(a.topQuizzes().get(0).label()).isEqualTo("Réseaux OSI");
        assertThat(a.topQuizzes().get(0).id()).isEqualTo(42L);
        assertThat(a.topDocs().get(0).count()).isEqualTo(231);
        assertThat(a.topDocs().get(0).id()).isEqualTo(7L);
        assertThat(a.topTools().get(0).id()).isNull();
    }
}
