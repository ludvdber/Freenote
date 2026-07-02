package be.freenote.entity;

/**
 * One task inside the {@code gantt_charts.tasks} JSONB array. Mirrors the frappe-gantt task shape:
 * {@code start}/{@code end} are ISO dates ("YYYY-MM-DD"), {@code progress} a 0–100 percentage,
 * {@code dependencies} a comma-separated list of task ids. Plain data, React/frappe-gantt escape it.
 */
public record GanttTaskJson(
        String id,
        String name,
        String start,
        String end,
        int progress,
        String dependencies
) {}
