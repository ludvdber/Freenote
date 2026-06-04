package be.freenote.service.impl;

import be.freenote.dto.response.NotificationResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.entity.Notification;
import be.freenote.entity.User;
import be.freenote.repository.NotificationRepository;
import be.freenote.repository.Repositories;
import be.freenote.repository.UserRepository;
import be.freenote.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NotificationServiceImpl implements NotificationService {

    /** 30 minutes matches typical CDN / nginx proxy_read_timeout; the browser reconnects after. */
    private static final long SSE_TIMEOUT_MS = 30L * 60 * 1000;

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    /** One user can have multiple tabs open, so we keep a list per userId. */
    private final Map<Long, CopyOnWriteArrayList<SseEmitter>> emitters = new ConcurrentHashMap<>();

    @Override
    @Transactional
    public void push(Long userId, String type, Map<String, Object> payload) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        Notification saved = notificationRepository.save(Notification.builder()
                .user(user)
                .type(type)
                .payload(payload == null ? Map.of() : payload)
                .build());

        NotificationResponse dto = toDto(saved);
        fanOut(userId, dto);
    }

    @Override
    public PageResponse<NotificationResponse> list(Long userId, Pageable pageable) {
        Page<Notification> page = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
        List<NotificationResponse> content = page.getContent().stream().map(this::toDto).toList();
        return PageResponse.from(page, content);
    }

    @Override
    public long unreadCount(Long userId) {
        return notificationRepository.countByUserIdAndReadAtIsNull(userId);
    }

    @Override
    @Transactional
    public void markAllRead(Long userId) {
        notificationRepository.markAllReadForUser(userId, LocalDateTime.now());
    }

    @Override
    public SseEmitter subscribe(Long userId) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        emitters.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>()).add(emitter);

        emitter.onCompletion(() -> removeEmitter(userId, emitter));
        emitter.onTimeout(() -> { emitter.complete(); removeEmitter(userId, emitter); });
        emitter.onError(e -> removeEmitter(userId, emitter));

        try {
            // Immediate event so the client knows the stream is open; the @Scheduled heartbeat()
            // below then keeps it alive against idle-connection cutoffs (Cloudflare ~100 s).
            emitter.send(SseEmitter.event().name("ping").data("ok"));
        } catch (IOException ignored) { /* client already gone, cleanup will happen */ }

        return emitter;
    }

    private void fanOut(Long userId, NotificationResponse dto) {
        List<SseEmitter> userEmitters = emitters.get(userId);
        if (userEmitters == null) return;
        for (SseEmitter e : userEmitters) {
            try {
                e.send(SseEmitter.event().name("notification").data(dto));
            } catch (IOException ex) {
                removeEmitter(userId, e);
            }
        }
    }

    private void removeEmitter(Long userId, SseEmitter emitter) {
        CopyOnWriteArrayList<SseEmitter> list = emitters.get(userId);
        if (list != null) list.remove(emitter);
    }

    /** Cloudflare (orange) drops an idle proxied connection after ~100 s, while an SSE stream is
     *  meant to live {@code SSE_TIMEOUT_MS} (30 min). Emit a comment ping every 25 s so the
     *  connection never looks idle — a ":" comment line keeps the socket warm without firing the
     *  client's event handlers. Without this, notifications silently stop flowing ~100 s after the
     *  last real event in prod (invisible in dev, where there is no Cloudflare in front). */
    @Scheduled(fixedRate = 25_000)
    public void heartbeat() {
        emitters.forEach((userId, list) -> {
            for (SseEmitter emitter : list) {
                try {
                    emitter.send(SseEmitter.event().comment("ping"));
                } catch (IOException | IllegalStateException ex) {
                    removeEmitter(userId, emitter);
                }
            }
        });
    }

    /** Garbage-collect notifications older than 90 days — keeps the table bounded. */
    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void purgeOldNotifications() {
        int deleted = notificationRepository.deleteOlderThan(LocalDateTime.now().minusDays(90));
        if (deleted > 0) log.info("Purged {} notifications older than 90 days", deleted);
    }

    private NotificationResponse toDto(Notification n) {
        return new NotificationResponse(n.getId(), n.getType(), n.getPayload(), n.getReadAt() != null, n.getCreatedAt());
    }
}
