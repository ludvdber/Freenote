package be.freenote.controller;

import be.freenote.security.SecurityUtils;
import be.freenote.dto.response.NotificationResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private static final int MAX_PAGE_SIZE = 50;

    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<PageResponse<NotificationResponse>> list(
            Authentication authentication,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.ok(notificationService.list(userId,
                PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), MAX_PAGE_SIZE))));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Long> unreadCount(Authentication authentication) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.ok(notificationService.unreadCount(userId));
    }

    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllRead(Authentication authentication) {
        Long userId = SecurityUtils.currentUserId(authentication);
        notificationService.markAllRead(userId);
        return ResponseEntity.noContent().build();
    }

    /** Server-Sent Events stream. The browser reconnects automatically when the 30-min
     *  timeout fires, so the client doesn't need any extra wiring. */
    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(Authentication authentication) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return notificationService.subscribe(userId);
    }
}
