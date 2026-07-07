package be.freenote.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Payload to create or update a guide (admin only). {@code content} is raw Markdown (rendered +
 * sanitised on the client). The slug is derived server-side from the title at creation and never
 * changes on update, so the public URL stays stable. {@code relatedTool} is an optional /outils
 * tool slug (the admin UI offers a dropdown of existing tools; the pattern only guards junk).
 */
public record CreateGuideRequest(
        @NotBlank @Size(max = 160) String title,
        @Size(max = 300) String summary,
        @NotBlank @Size(max = 50_000) String content,
        @Size(max = 40) String category,
        @Size(max = 40) @Pattern(regexp = "^[a-z0-9-]*$") String relatedTool,
        boolean published
) {}
