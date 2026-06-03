package be.freenote.service;

import be.freenote.dto.response.ActivityLogResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.enums.ActivityType;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;

public interface ActivityLogService {

    /** Records an event. Never throws — a logging failure must not break the action it records. */
    void log(ActivityType type, Long actorId, String actorName, String message);

    PageResponse<ActivityLogResponse> list(String type, Pageable pageable);

    /** Deletes every log strictly older than {@code before}. Returns the number of rows removed. */
    int purgeBefore(LocalDateTime before);
}
