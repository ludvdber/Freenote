package be.freenote.event;

import be.freenote.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Bridges domain events to the notification queue. Runs <strong>asynchronously</strong> so the
 * admin's "verify document" request returns as soon as the DB commit is done — the notification
 * insert + SSE fan-out happen on a worker thread, not on the HTTP thread.
 *
 * <p>Kept separate from {@link XpEventListener} so a transient notification failure
 * doesn't rollback the XP award.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationEventListener {

    private final NotificationService notificationService;

    @Async
    @EventListener
    public void onDocumentVerified(XpEvent.DocumentVerified event) {
        notificationService.push(
                event.authorId(),
                "document.verified",
                Map.of("documentId", event.documentId(), "title", event.title())
        );
    }
}
