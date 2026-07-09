package be.freenote.service.impl;

import be.freenote.dto.response.AdminOverviewResponse;
import be.freenote.dto.response.AnalyticsResponse;
import be.freenote.enums.ActivityType;
import be.freenote.enums.ReportStatus;
import be.freenote.repository.ActivityLogRepository;
import be.freenote.repository.DailyStatRepository;
import be.freenote.repository.DocumentRepository;
import be.freenote.repository.QuizRepository;
import be.freenote.repository.ReportRepository;
import be.freenote.service.AnalyticsService;
import be.freenote.service.TrackingService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AnalyticsServiceImpl implements AnalyticsService {

    private static final int TOP_LIMIT = 8;

    private final DailyStatRepository dailyStatRepository;
    private final ActivityLogRepository activityLogRepository;
    private final DocumentRepository documentRepository;
    private final ReportRepository reportRepository;
    private final QuizRepository quizRepository;

    @Override
    public AdminOverviewResponse getOverview() {
        LocalDate tomorrow = LocalDate.now().plusDays(1); // borne exclusive : inclut aujourd'hui
        LocalDate from7 = tomorrow.minusDays(7);
        LocalDate prevFrom7 = from7.minusDays(7);

        // Série 14 jours fusionnée (visites + vues docs + parties de quiz), zéro-fillée : les jours
        // sans activité doivent exister pour que le graphe garde un axe temporel régulier.
        LocalDate from14 = tomorrow.minusDays(14);
        Map<LocalDate, long[]> byDay = new HashMap<>();
        mergeSeries(byDay, TrackingService.METRIC_VISIT, from14, tomorrow, 0);
        mergeSeries(byDay, TrackingService.METRIC_DOC_VIEW, from14, tomorrow, 1);
        mergeSeries(byDay, TrackingService.METRIC_QUIZ_PLAY, from14, tomorrow, 2);
        List<AdminOverviewResponse.DayActivity> activity = from14.datesUntil(tomorrow)
                .map(day -> {
                    long[] v = byDay.getOrDefault(day, new long[3]);
                    return new AdminOverviewResponse.DayActivity(day, v[0], v[1], v[2]);
                })
                .toList();

        return new AdminOverviewResponse(
                documentRepository.countByVerifiedFalse(),
                reportRepository.countByStatus(ReportStatus.PENDING),
                documentRepository.countDuplicateGroups(),
                kpi(TrackingService.METRIC_VISIT, from7, tomorrow, prevFrom7),
                kpi(TrackingService.METRIC_DOC_VIEW, from7, tomorrow, prevFrom7),
                kpi(TrackingService.METRIC_QUIZ_PLAY, from7, tomorrow, prevFrom7),
                signupsKpi(from7, tomorrow, prevFrom7),
                activity
        );
    }

    @Override
    public AnalyticsResponse getAnalytics(int days) {
        int clamped = Math.min(Math.max(days, 7), 365);
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        LocalDate from = tomorrow.minusDays(clamped);
        LocalDate prevFrom = from.minusDays(clamped);
        PageRequest top = PageRequest.of(0, TOP_LIMIT);

        // Série visites zéro-fillée sur toute la période.
        Map<LocalDate, Long> visitDays = new HashMap<>();
        dailyStatRepository.seriesBetween(TrackingService.METRIC_VISIT, from, tomorrow)
                .forEach(row -> visitDays.put(row.getDay(), row.getTotal()));
        List<AnalyticsResponse.DayCount> visitsByDay = from.datesUntil(tomorrow)
                .map(day -> new AnalyticsResponse.DayCount(day, visitDays.getOrDefault(day, 0L)))
                .toList();

        return new AnalyticsResponse(
                clamped,
                akpi(TrackingService.METRIC_VISIT, from, tomorrow, prevFrom),
                akpi(TrackingService.METRIC_DOC_VIEW, from, tomorrow, prevFrom),
                akpi(TrackingService.METRIC_QUIZ_PLAY, from, tomorrow, prevFrom),
                akpi(TrackingService.METRIC_GUIDE, from, tomorrow, prevFrom),
                akpi(TrackingService.METRIC_TOOL, from, tomorrow, prevFrom),
                new AnalyticsResponse.Kpi(
                        countSignups(from, tomorrow),
                        countSignups(prevFrom, from)),
                visitsByDay,
                labelCounts(TrackingService.METRIC_VISIT, from, tomorrow, PageRequest.of(0, 10)),
                labelCounts(TrackingService.METRIC_TOOL, from, tomorrow, top),
                labelCounts(TrackingService.METRIC_GUIDE, from, tomorrow, top),
                quizRepository.findTopByAttempts(top).stream()
                        .map(q -> new AnalyticsResponse.LabelCount(q.getTitle(), q.getAttemptCount(), q.getId()))
                        .toList(),
                documentRepository.findTop8ByVerifiedTrueOrderByDownloadCountDesc().stream()
                        .map(d -> new AnalyticsResponse.LabelCount(d.getTitle(), d.getDownloadCount(), d.getId()))
                        .toList()
        );
    }

    private void mergeSeries(Map<LocalDate, long[]> byDay, String metric,
                             LocalDate from, LocalDate to, int slot) {
        dailyStatRepository.seriesBetween(metric, from, to).forEach(row ->
                byDay.computeIfAbsent(row.getDay(), d -> new long[3])[slot] = row.getTotal());
    }

    private AdminOverviewResponse.Kpi kpi(String metric, LocalDate from, LocalDate to, LocalDate prevFrom) {
        return new AdminOverviewResponse.Kpi(
                dailyStatRepository.sumBetween(metric, from, to),
                dailyStatRepository.sumBetween(metric, prevFrom, from));
    }

    private AnalyticsResponse.Kpi akpi(String metric, LocalDate from, LocalDate to, LocalDate prevFrom) {
        return new AnalyticsResponse.Kpi(
                dailyStatRepository.sumBetween(metric, from, to),
                dailyStatRepository.sumBetween(metric, prevFrom, from));
    }

    private AdminOverviewResponse.Kpi signupsKpi(LocalDate from, LocalDate to, LocalDate prevFrom) {
        return new AdminOverviewResponse.Kpi(countSignups(from, to), countSignups(prevFrom, from));
    }

    /** Les SIGNUP vivent dans activity_logs (horodatés) — pas besoin de les re-tracker. */
    private long countSignups(LocalDate from, LocalDate to) {
        return activityLogRepository.countByTypeAndCreatedAtGreaterThanEqual(
                ActivityType.SIGNUP.name(), from.atStartOfDay())
                - activityLogRepository.countByTypeAndCreatedAtGreaterThanEqual(
                ActivityType.SIGNUP.name(), to.atStartOfDay());
    }

    private List<AnalyticsResponse.LabelCount> labelCounts(String metric, LocalDate from, LocalDate to,
                                                           PageRequest pageable) {
        return dailyStatRepository.topTargetsBetween(metric, from, to, pageable).stream()
                .map(row -> new AnalyticsResponse.LabelCount(row.getTarget(), row.getTotal(), null))
                .toList();
    }
}
