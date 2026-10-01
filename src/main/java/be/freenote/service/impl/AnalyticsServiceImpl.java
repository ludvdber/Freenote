package be.freenote.service.impl;

import be.freenote.dto.response.AdminOverviewResponse;
import be.freenote.dto.response.AnalyticsResponse;
import be.freenote.enums.ReportStatus;
import be.freenote.repository.DailyStatRepository;
import be.freenote.repository.DocumentRepository;
import be.freenote.repository.QuizRepository;
import be.freenote.repository.ReportRepository;
import be.freenote.repository.UserRepository;
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
    private final DocumentRepository documentRepository;
    private final ReportRepository reportRepository;
    private final QuizRepository quizRepository;
    private final UserRepository userRepository;

    @Override
    public AdminOverviewResponse getOverview() {
        LocalDate today = LocalDate.now();
        LocalDate tomorrow = today.plusDays(1); // borne exclusive : la SÉRIE inclut aujourd'hui
        // Les KPI, eux, s'arrêtent à hier — un jour partiel face à des jours complets rendait tous
        // les deltas rouges le matin (même raison que dans getAnalytics).
        LocalDate from7 = today.minusDays(7);
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
                kpi(TrackingService.METRIC_VISIT, from7, today, prevFrom7),
                kpi(TrackingService.METRIC_DOC_VIEW, from7, today, prevFrom7),
                kpi(TrackingService.METRIC_QUIZ_PLAY, from7, today, prevFrom7),
                signupsKpi(from7, today, prevFrom7),
                activity
        );
    }

    @Override
    public be.freenote.dto.response.ModerationQueueResponse getModerationQueue() {
        // Mêmes sources que les trois premiers champs de getOverview() — garder les deux synchronisés.
        return new be.freenote.dto.response.ModerationQueueResponse(
                documentRepository.countByVerifiedFalse(),
                reportRepository.countByStatus(ReportStatus.PENDING),
                documentRepository.countDuplicateGroups());
    }

    @Override
    public AnalyticsResponse getAnalytics(int days) {
        int clamped = Math.min(Math.max(days, 7), 365);
        // Les KPI s'arrêtent à HIER : comparer une période dont le jour en cours, incomplet, à une
        // période complète rendait tous les deltas négatifs le matin. `today` ne sert qu'au graphe.
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(clamped);
        LocalDate prevFrom = from.minusDays(clamped);
        PageRequest top = PageRequest.of(0, TOP_LIMIT);

        // Série visites zéro-fillée, jour en cours INCLUS (une barre partielle se lit pour ce
        // qu'elle est, contrairement à un delta).
        LocalDate tomorrow = today.plusDays(1);
        Map<LocalDate, Long> visitDays = new HashMap<>();
        dailyStatRepository.seriesBetween(TrackingService.METRIC_VISIT, from, tomorrow)
                .forEach(row -> visitDays.put(row.getDay(), row.getTotal()));
        List<AnalyticsResponse.DayCount> visitsByDay = from.datesUntil(tomorrow)
                .map(day -> new AnalyticsResponse.DayCount(day, visitDays.getOrDefault(day, 0L)))
                .toList();

        return new AnalyticsResponse(
                clamped,
                today.minusDays(1),
                akpi(TrackingService.METRIC_VISIT, from, today, prevFrom),
                akpi(TrackingService.METRIC_VISIT_NEW, from, today, prevFrom),
                akpi(TrackingService.METRIC_DOC_VIEW, from, today, prevFrom),
                akpi(TrackingService.METRIC_QUIZ_PLAY, from, today, prevFrom),
                akpi(TrackingService.METRIC_GUIDE, from, today, prevFrom),
                akpi(TrackingService.METRIC_TOOL, from, today, prevFrom),
                new AnalyticsResponse.Kpi(
                        countSignups(from, today),
                        countSignups(prevFrom, from)),
                visitsByDay,
                labelCounts(TrackingService.METRIC_VISIT, from, today, PageRequest.of(0, 10)),
                labelCounts(TrackingService.METRIC_CAMPAIGN, from, today, top),
                labelCounts(TrackingService.METRIC_TOOL, from, today, top),
                labelCounts(TrackingService.METRIC_GUIDE, from, today, top),
                topQuizzes(from, today, top),
                topDocs(from, today, top),
                labelCounts(TrackingService.METRIC_SEARCH_MISS, from, today, PageRequest.of(0, 15))
        );
    }

    /**
     * Tops SUR LA PÉRIODE, lus dans {@code daily_stats} (cible = id) et non plus sur les compteurs
     * dénormalisés all-time : la question utile est « qu'est-ce qui marche en ce moment », pas
     * « quel document a accumulé le plus de vues depuis toujours » — un ancien doc occupait la
     * première place indéfiniment, et les deux panneaux ignoraient le sélecteur de période.
     *
     * <p>Les lignes dont l'objet a été supprimé depuis sont écartées (plutôt qu'affichées avec un
     * libellé d'identifiant nu), et le titre est résolu en UNE requête par classement.</p>
     */
    private List<AnalyticsResponse.LabelCount> topDocs(LocalDate from, LocalDate to, PageRequest top) {
        return resolveTitles(TrackingService.METRIC_DOC_VIEW, from, to, top,
                ids -> documentRepository.findAllById(ids).stream()
                        .collect(java.util.stream.Collectors.toMap(d -> d.getId(), d -> d.getTitle())));
    }

    private List<AnalyticsResponse.LabelCount> topQuizzes(LocalDate from, LocalDate to, PageRequest top) {
        return resolveTitles(TrackingService.METRIC_QUIZ_PLAY, from, to, top,
                ids -> quizRepository.findAllById(ids).stream()
                        .collect(java.util.stream.Collectors.toMap(q -> q.getId(), q -> q.getTitle())));
    }

    private List<AnalyticsResponse.LabelCount> resolveTitles(
            String metric, LocalDate from, LocalDate to, PageRequest top,
            java.util.function.Function<List<Long>, Map<Long, String>> titlesByIds) {
        List<DailyStatRepository.TargetTotal> rows = dailyStatRepository.topTargetsBetween(metric, from, to, top);
        List<Long> ids = rows.stream().map(row -> parseId(row.getTarget())).filter(java.util.Objects::nonNull).toList();
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<Long, String> titles = titlesByIds.apply(ids);
        return rows.stream()
                .map(row -> {
                    Long id = parseId(row.getTarget());
                    String title = id == null ? null : titles.get(id);
                    return title == null ? null : new AnalyticsResponse.LabelCount(title, row.getTotal(), id);
                })
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    /** Les lignes historiques du tracking portent une cible vide (avant que l'id y soit écrit). */
    private static Long parseId(String target) {
        try {
            return Long.valueOf(target);
        } catch (NumberFormatException e) {
            return null;
        }
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

    /** Comptées sur users.created_at, jamais purgé — voir le javadoc du repository. */
    private long countSignups(LocalDate from, LocalDate to) {
        return userRepository.countByCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                from.atStartOfDay(), to.atStartOfDay());
    }

    private List<AnalyticsResponse.LabelCount> labelCounts(String metric, LocalDate from, LocalDate to,
                                                           PageRequest pageable) {
        return dailyStatRepository.topTargetsBetween(metric, from, to, pageable).stream()
                .map(row -> new AnalyticsResponse.LabelCount(row.getTarget(), row.getTotal(), null))
                .toList();
    }
}
