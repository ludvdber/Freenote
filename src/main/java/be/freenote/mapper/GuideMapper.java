package be.freenote.mapper;

import be.freenote.dto.response.GuideResponse;
import be.freenote.dto.response.GuideSummary;
import be.freenote.entity.Guide;

/** Static guide → DTO mapping. The author name is a stored snapshot — no repository query. */
public final class GuideMapper {

    private GuideMapper() {}

    public static GuideSummary toSummary(Guide g) {
        return new GuideSummary(
                g.getId(), g.getSlug(), g.getTitle(), g.getSummary(), g.getCategory(),
                g.getAuthorName(), g.isPublished(), g.getCreatedAt(), g.getUpdatedAt());
    }

    public static GuideResponse toResponse(Guide g) {
        return new GuideResponse(
                g.getId(), g.getSlug(), g.getTitle(), g.getSummary(), g.getContent(), g.getCategory(),
                g.getAuthorName(), g.isPublished(), g.getCreatedAt(), g.getUpdatedAt());
    }
}
