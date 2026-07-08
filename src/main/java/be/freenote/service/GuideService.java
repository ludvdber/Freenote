package be.freenote.service;

import be.freenote.dto.request.CreateGuideRequest;
import be.freenote.dto.response.GuideResponse;
import be.freenote.dto.response.GuideSummary;
import be.freenote.dto.response.PageResponse;
import org.springframework.data.domain.Pageable;

public interface GuideService {

    /** Public: published guides only. {@code authorId} (nullable) filtre les guides d'un auteur
     *  (section du profil public). */
    PageResponse<GuideSummary> listPublished(Long authorId, Pageable pageable);

    /** Public: a published guide by slug (404 if missing or still a draft). Pour un guide
     *  {@code membersOnly} et un appelant non vérifié, le contenu est retiré de la réponse. */
    GuideResponse getPublishedBySlug(String slug, boolean callerVerified);

    /** Admin: all guides, drafts included. */
    PageResponse<GuideSummary> listAll(Pageable pageable);

    /** Admin: any guide by id (drafts included), for the editor. */
    GuideResponse getById(Long id);

    GuideResponse create(Long adminId, CreateGuideRequest request);

    GuideResponse update(Long id, CreateGuideRequest request);

    void delete(Long id);
}
