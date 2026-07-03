package be.freenote.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** One task in a save request (and echoed back in responses). Dates are ISO "YYYY-MM-DD". */
public record GanttTaskDto(
        @Size(max = 40) String id,
        @NotBlank @Size(max = 200) String name,
        @Size(max = 10) String start,
        @Size(max = 10) String end,
        int progress,
        @Size(max = 500) String dependencies,
        @Size(max = 60) String assignee
) {}
