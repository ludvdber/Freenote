package be.freenote.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Payload to save (or update) a Gantt project to the user's account. {@code shared} publishes it. */
public record SaveGanttRequest(
        @NotBlank @Size(max = 100) String title,
        @NotEmpty @Size(max = 300) @Valid List<GanttTaskDto> tasks,
        boolean shared
) {}
