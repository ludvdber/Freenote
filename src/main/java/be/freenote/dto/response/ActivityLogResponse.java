package be.freenote.dto.response;

import java.time.LocalDateTime;

public record ActivityLogResponse(
        Long id,
        String type,
        Long actorId,
        String actorName,
        String message,
        LocalDateTime createdAt
) {}
