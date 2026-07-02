package be.freenote.dto.response;

import java.time.LocalDateTime;

/** Gantt list item — no tasks body (kept light for the "my projects" + shared library lists). */
public record GanttSummary(
        Long id,
        String title,
        int taskCount,
        boolean shared,
        String ownerName,
        LocalDateTime updatedAt
) {}
