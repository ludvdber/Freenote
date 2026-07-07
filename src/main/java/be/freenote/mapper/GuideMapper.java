package be.freenote.mapper;

import be.freenote.dto.response.GuideResponse;
import be.freenote.dto.response.GuideSummary;
import be.freenote.entity.Guide;

/** Static guide → DTO mapping. The author name is a stored snapshot — no repository query. */
public final class GuideMapper {

    /** Average adult reading speed used for the "N min" estimate on index cards. */
    private static final int WORDS_PER_MINUTE = 200;

    private GuideMapper() {}

    public static GuideSummary toSummary(Guide g) {
        return new GuideSummary(
                g.getId(), g.getSlug(), g.getTitle(), g.getSummary(), g.getCategory(), g.getRelatedTool(),
                g.getAuthorName(), g.isPublished(), readMinutes(g.getContent()),
                g.getCreatedAt(), g.getUpdatedAt());
    }

    public static GuideResponse toResponse(Guide g) {
        return new GuideResponse(
                g.getId(), g.getSlug(), g.getTitle(), g.getSummary(), g.getContent(), g.getCategory(),
                g.getRelatedTool(), g.getAuthorName(), g.isPublished(), g.getCreatedAt(), g.getUpdatedAt());
    }

    /** Word-count estimate over the raw Markdown (punctuation stripped), floored at 1 minute. */
    static int readMinutes(String content) {
        if (content == null || content.isBlank()) {
            return 1;
        }
        int words = content.replaceAll("[#>*`_\\-\\[\\]()]", " ").trim().split("\\s+").length;
        return Math.max(1, Math.round(words / (float) WORDS_PER_MINUTE));
    }
}
