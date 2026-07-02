package be.freenote.dto.response;

import be.freenote.dto.request.GanttTaskDto;

import java.time.LocalDateTime;
import java.util.List;

/** Full Gantt project, including its tasks — for loading into the editor or viewing a shared one. */
public record GanttResponse(
        Long id,
        String title,
        List<GanttTaskDto> tasks,
        boolean shared,
        String ownerName,
        boolean owned,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
