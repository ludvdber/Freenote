package be.freenote.mapper;

import be.freenote.dto.request.GanttTaskDto;
import be.freenote.dto.response.GanttResponse;
import be.freenote.dto.response.GanttSummary;
import be.freenote.entity.GanttChart;
import be.freenote.entity.User;

import java.util.List;

/** Static Gantt → DTO mapping. Owner name honours the display-name preference; "Anonyme" if orphaned. */
public final class GanttMapper {

    private GanttMapper() {}

    public static GanttSummary toSummary(GanttChart g) {
        return new GanttSummary(g.getId(), g.getTitle(), g.getTaskCount(), g.isShared(), ownerName(g), g.getUpdatedAt());
    }

    public static GanttResponse toResponse(GanttChart g, boolean owned) {
        List<GanttTaskDto> tasks = g.getTasks().stream()
                .map(t -> new GanttTaskDto(t.id(), t.name(), t.start(), t.end(), t.progress(), t.dependencies(), t.assignee()))
                .toList();
        return new GanttResponse(g.getId(), g.getTitle(), tasks, g.isShared(), ownerName(g), owned,
                g.getCreatedAt(), g.getUpdatedAt());
    }

    private static String ownerName(GanttChart g) {
        User o = g.getOwner();
        return o == null ? "Anonyme" : UserMapper.resolveDisplayName(o.getProfile(), o.getUsername());
    }
}
