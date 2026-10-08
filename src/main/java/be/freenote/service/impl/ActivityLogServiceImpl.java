package be.freenote.service.impl;

import be.freenote.dto.response.ActivityLogResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.entity.ActivityLog;
import be.freenote.entity.User;
import be.freenote.enums.ActivityType;
import be.freenote.enums.ActivityType.Retention;
import be.freenote.repository.ActivityLogRepository;
import be.freenote.repository.UserRepository;
import be.freenote.security.SecurityUtils;
import be.freenote.service.ActivityLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@Slf4j
@Service
@RequiredArgsConstructor
public class ActivityLogServiceImpl implements ActivityLogService {

    private static final String NOTABLE = "NOTABLE";

    private final ActivityLogRepository repository;
    private final UserRepository userRepository;

    /** Durées de conservation par classe (cf. {@link Retention}). 0/négatif désactive la purge de la classe. */
    @Value("${app.activity-log.short-retention-days:30}")
    private int shortRetentionDays;

    @Value("${app.activity-log.retention-days:90}")
    private int retentionDays;

    @Value("${app.activity-log.audit-retention-days:365}")
    private int auditRetentionDays;

    // REQUIRES_NEW so a logging hiccup is fully isolated from the user-facing transaction (login,
    // upload, …) it records — that action must never fail because of the audit trail.
    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(ActivityType type, Long actorId, String actorName, String message) {
        try {
            repository.save(ActivityLog.builder()
                    .type(type.name())
                    .actorId(actorId)
                    .actorName(actorName)
                    .message(truncate(message))
                    .build());
        } catch (Exception e) {
            log.warn("Failed to write activity log {}: {}", type, e.getMessage());
        }
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logStaff(ActivityType type, String message) {
        try {
            Long actorId = SecurityUtils.currentUserIdOrNull(SecurityContextHolder.getContext().getAuthentication());
            String actorName = actorId == null ? null
                    : userRepository.findById(actorId).map(User::getUsername).orElse(null);
            log(type, actorId, actorName, message);
        } catch (Exception e) {
            log.warn("Failed to write staff activity log {}: {}", type, e.getMessage());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ActivityLogResponse> list(String type, String text, Pageable pageable) {
        String t = type == null || type.isBlank() ? null : type.trim();
        String q = text == null || text.isBlank() ? null : text.trim();
        Page<ActivityLog> page;
        if (t == null && q == null) {
            page = repository.findAllByOrderByCreatedAtDesc(pageable);
        } else {
            List<String> types = t == null ? List.of() : resolveTypes(t);
            page = repository.search(t == null, types.isEmpty() ? List.of("") : types,
                    q == null ? null : "%" + q.toLowerCase(Locale.ROOT) + "%", pageable);
        }
        List<ActivityLogResponse> content = page.getContent().stream().map(this::toResponse).toList();
        return PageResponse.from(page, content);
    }

    /**
     * « EMAIL_* » = tous les types du préfixe, « NOTABLE » = tout sauf le bruit ; sinon le type tel
     * quel (un type inconnu ne matche rien).
     */
    private static List<String> resolveTypes(String t) {
        if (NOTABLE.equals(t)) return ActivityType.notableNames();
        if (!t.endsWith("*")) return List.of(t);
        String prefix = t.substring(0, t.length() - 1);
        return Arrays.stream(ActivityType.values()).map(Enum::name).filter(n -> n.startsWith(prefix)).toList();
    }

    @Override
    @Transactional
    public int purgeBefore(LocalDateTime before) {
        List<String> purgeable = Arrays.stream(ActivityType.values())
                .filter(t -> t.retention() != Retention.AUDIT).map(Enum::name).toList();
        int deleted = repository.deleteByTypeInAndCreatedAtBefore(purgeable, before);
        log.info("Admin purged {} activity log(s) older than {}", deleted, before);
        return deleted;
    }

    /** Purge quotidienne, classe par classe : la table reste bornée sans perdre les traces du staff. */
    @Scheduled(cron = "${app.activity-log.purge-cron:0 30 3 * * *}")
    @Transactional
    public void autoPrune() {
        prune(Retention.SHORT, shortRetentionDays);
        prune(Retention.STANDARD, retentionDays);
        prune(Retention.AUDIT, auditRetentionDays);
    }

    private void prune(Retention retention, int days) {
        if (days <= 0) return;
        int deleted = repository.deleteByTypeInAndCreatedAtBefore(
                ActivityType.namesWith(retention), LocalDateTime.now().minusDays(days));
        if (deleted > 0) log.info("Auto-pruned {} {} activity log(s) older than {} days", deleted, retention, days);
    }

    private ActivityLogResponse toResponse(ActivityLog a) {
        return new ActivityLogResponse(a.getId(), a.getType(), a.getActorId(),
                a.getActorName(), a.getMessage(), a.getCreatedAt());
    }

    private static String truncate(String s) {
        if (s == null) return null;
        return s.length() > 255 ? s.substring(0, 255) : s;
    }
}
