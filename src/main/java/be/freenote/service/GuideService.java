package be.freenote.service;

import be.freenote.dto.request.CreateGuideRequest;
import be.freenote.dto.response.GuideResponse;
import be.freenote.dto.response.GuideSummary;
import be.freenote.dto.response.PageResponse;
import org.springframework.data.domain.Pageable;

public interface GuideService {

    /** Public: published guides only. */
    PageResponse<GuideSummary> listPublished(Pageable pageable);

    /** Public: a published guide by slug (404 if missing or still a draft). */
    GuideResponse getPublishedBySlug(String slug);

    /** Admin: all guides, drafts included. */
    PageResponse<GuideSummary> listAll(Pageable pageable);

    /** Admin: any guide by id (drafts included), for the editor. */
    GuideResponse getById(Long id);

    GuideResponse create(Long adminId, CreateGuideRequest request);

    GuideResponse update(Long id, CreateGuideRequest request);

    void delete(Long id);
}
