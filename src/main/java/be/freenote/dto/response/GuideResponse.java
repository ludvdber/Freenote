package be.freenote.dto.response;

import java.time.LocalDateTime;

/** Full guide, including the Markdown {@code content} (rendered + sanitised on the client).
 *  Pour un guide {@code membersOnly} lu par un appelant NON vérifié, {@code content} est {@code null}
 *  (le client affiche le panneau « réservé aux étudiants » avec les métadonnées). */
public record GuideResponse(
        Long id,
        String slug,
        String title,
        String summary,
        String content,
        String category,
        String relatedTool,
        String authorName,
        boolean published,
        boolean membersOnly,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
