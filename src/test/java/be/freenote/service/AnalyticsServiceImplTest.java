package be.freenote.service;

import be.freenote.dto.response.AdminOverviewResponse;
import be.freenote.dto.response.AnalyticsResponse;
import be.freenote.entity.Document;
import be.freenote.enums.ReportStatus;
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
    @Mock private be.freenote.repository.UserRepository userRepository;
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
        when(userRepository.countByCreatedAtGreaterThanEqualAndCreatedAtLessThan(any(), any()))
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
        // Inscriptions comptées sur users.created_at (jamais purgé, contrairement à activity_logs,
        // dont la purge à 90 jours vidait la période de comparaison de la vue « 90 jours »).
        assertThat(overview.signups7d().value()).isEqualTo(5);
    }

    @Test
    void analyticsClampsTheRequestedPeriod() {
        when(dailyStatRepository.sumBetween(anyString(), any(), any())).thenReturn(0L);
        when(dailyStatRepository.seriesBetween(anyString(), any(), any())).thenReturn(List.of());
        when(dailyStatRepository.topTargetsBetween(anyString(), any(), any(), any())).thenReturn(List.of());
        when(userRepository.countByCreatedAtGreaterThanEqualAndCreatedAtLessThan(any(), any())).thenReturn(0L);

        assertThat(analyticsService.getAnalytics(1000).days()).isEqualTo(365);
        assertThat(analyticsService.getAnalytics(1).days()).isEqualTo(7);
        // 30 jours complets + le jour en cours : la série montre la journée partielle, dont les KPI
        // s'abstiennent pour ne pas fausser les comparaisons.
        assertThat(analyticsService.getAnalytics(30).visitsByDay()).hasSize(31);
    }

    @Test
    void analyticsMapsSourcesAndPeriodScopedTops() {
        when(dailyStatRepository.sumBetween(anyString(), any(), any())).thenReturn(4L);
        when(dailyStatRepository.seriesBetween(anyString(), any(), any())).thenReturn(List.of());
        when(userRepository.countByCreatedAtGreaterThanEqualAndCreatedAtLessThan(any(), any())).thenReturn(0L);
        when(dailyStatRepository.topTargetsBetween(eq("visit"), any(), any(), any()))
                .thenReturn(List.of(target("organic", 12), target("direct", 5)));
        when(dailyStatRepository.topTargetsBetween(eq("tool"), any(), any(), any()))
                .thenReturn(List.of(target("quiz", 9)));
        when(dailyStatRepository.topTargetsBetween(eq("guide"), any(), any(), any()))
                .thenReturn(List.of(target("jointures-sql", 6)));
        when(dailyStatRepository.topTargetsBetween(eq("campaign"), any(), any(), any()))
                .thenReturn(List.of(target("qr-rentree", 30)));
        when(dailyStatRepository.topTargetsBetween(eq("search_miss"), any(), any(), any()))
                .thenReturn(List.of(target("compta analytique", 11)));
        when(dailyStatRepository.topTargetsBetween(eq("quiz_play"), any(), any(), any()))
                .thenReturn(List.of(target("42", 88)));
        when(dailyStatRepository.topTargetsBetween(eq("doc_view"), any(), any(), any()))
                .thenReturn(List.of(target("7", 231)));
        when(quizRepository.findAllById(List.of(42L)))
                .thenReturn(List.of(be.freenote.entity.Quiz.builder().id(42L).title("Réseaux OSI").build()));
        when(documentRepository.findAllById(List.of(7L)))
                .thenReturn(List.of(Document.builder().id(7L).title("Synthèse Java").build()));

        AnalyticsResponse a = analyticsService.getAnalytics(30);

        assertThat(a.sources()).extracting(AnalyticsResponse.LabelCount::label)
                .containsExactly("organic", "direct");
        assertThat(a.topTools().get(0).label()).isEqualTo("quiz");
        assertThat(a.topGuides().get(0).count()).isEqualTo(6);
        assertThat(a.campaigns().get(0).label()).isEqualTo("qr-rentree");
        assertThat(a.searchMisses().get(0).label()).isEqualTo("compta analytique");
        // Tops lus dans daily_stats SUR LA PÉRIODE (cible = id) et non plus sur les compteurs
        // all-time, qui ignoraient le sélecteur 30/90 jours juste au-dessus d'eux.
        assertThat(a.topQuizzes().get(0).label()).isEqualTo("Réseaux OSI");
        assertThat(a.topQuizzes().get(0).id()).isEqualTo(42L);
        assertThat(a.topDocs().get(0).count()).isEqualTo(231);
        assertThat(a.topDocs().get(0).id()).isEqualTo(7L);
        assertThat(a.topTools().get(0).id()).isNull();
    }

    /**
     * Les lignes historiques du tracking portent une cible VIDE (l'id n'y était pas écrit avant le
     * 1ᵉʳ octobre), et un objet supprimé laisse sa ligne de statistiques derrière lui. Dans les deux
     * cas le classement doit sauter la ligne, pas afficher un identifiant nu ni planter.
     */
    @Test
    void skipsTopRowsWithoutAResolvableObject() {
        when(dailyStatRepository.sumBetween(anyString(), any(), any())).thenReturn(0L);
        when(dailyStatRepository.seriesBetween(anyString(), any(), any())).thenReturn(List.of());
        when(dailyStatRepository.topTargetsBetween(anyString(), any(), any(), any())).thenReturn(List.of());
        when(userRepository.countByCreatedAtGreaterThanEqualAndCreatedAtLessThan(any(), any())).thenReturn(0L);
        when(dailyStatRepository.topTargetsBetween(eq("doc_view"), any(), any(), any()))
                .thenReturn(List.of(target("", 900), target("7", 12), target("999", 3)));
        when(documentRepository.findAllById(List.of(7L, 999L)))
                .thenReturn(List.of(Document.builder().id(7L).title("Synthèse Java").build()));

        AnalyticsResponse a = analyticsService.getAnalytics(30);

        assertThat(a.topDocs()).hasSize(1);
        assertThat(a.topDocs().get(0).label()).isEqualTo("Synthèse Java");
    }

    /**
     * Les KPI s'arrêtent à hier. Avant, une période « dont aujourd'hui, incomplet » était comparée à
     * une période complète : tous les deltas étaient négatifs le matin sans que rien n'ait baissé.
     * La série journalière, elle, garde le jour en cours — une barre partielle se lit pour ce
     * qu'elle est.
     */
    @Test
    void kpiWindowsStopAtYesterdayWhileTheSeriesKeepsToday() {
        when(dailyStatRepository.sumBetween(anyString(), any(), any())).thenReturn(0L);
        when(dailyStatRepository.seriesBetween(anyString(), any(), any())).thenReturn(List.of());
        when(dailyStatRepository.topTargetsBetween(anyString(), any(), any(), any())).thenReturn(List.of());
        when(userRepository.countByCreatedAtGreaterThanEqualAndCreatedAtLessThan(any(), any())).thenReturn(0L);

        AnalyticsResponse a = analyticsService.getAnalytics(30);

        assertThat(a.through()).isEqualTo(LocalDate.now().minusDays(1));
        assertThat(a.visitsByDay().getLast().day()).isEqualTo(LocalDate.now());
        // Borne haute exclusive = aujourd'hui : la somme ne touche aucune ligne du jour en cours.
        verify(dailyStatRepository).sumBetween("visit", LocalDate.now().minusDays(30), LocalDate.now());
    }
}
