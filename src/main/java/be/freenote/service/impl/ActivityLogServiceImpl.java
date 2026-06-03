package be.freenote.service.impl;

import be.freenote.dto.response.ActivityLogResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.entity.ActivityLog;
import be.freenote.enums.ActivityType;
import be.freenote.repository.ActivityLogRepository;
import be.freenote.service.ActivityLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ActivityLogServiceImpl implements ActivityLogService {

    private final ActivityLogRepository repository;

    /** Logs older than this are pruned daily. 0/negative disables auto-pruning. */
    @Value("${app.activity-log.retention-days:90}")
    private int retentionDays;

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
    @Transactional(readOnly = true)
    public PageResponse<ActivityLogResponse> list(String type, Pageable pageable) {
        Page<ActivityLog> page = (type == null || type.isBlank())
                ? repository.findAllByOrderByCreatedAtDesc(pageable)
                : repository.findByTypeOrderByCreatedAtDesc(type, pageable);
        List<ActivityLogResponse> content = page.getContent().stream().map(this::toResponse).toList();
        return PageResponse.from(page, content);
    }

    @Override
    @Transactional
    public int purgeBefore(LocalDateTime before) {
        int deleted = repository.deleteByCreatedAtBefore(before);
        log.info("Admin purged {} activity log(s) older than {}", deleted, before);
        return deleted;
    }

    /** Daily auto-prune keeps the table bounded so it can't fill the disk. */
    @Scheduled(cron = "${app.activity-log.purge-cron:0 30 3 * * *}")
    @Transactional
    public void autoPrune() {
        if (retentionDays <= 0) return;
        int deleted = repository.deleteByCreatedAtBefore(LocalDateTime.now().minusDays(retentionDays));
        if (deleted > 0) log.info("Auto-pruned {} activity log(s) older than {} days", deleted, retentionDays);
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
