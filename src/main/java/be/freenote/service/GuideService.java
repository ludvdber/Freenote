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

    /** Panel : tous les guides pour un admin (brouillons inclus) ; un rédacteur (V18) ne voit
     *  que LES SIENS. */
    PageResponse<GuideSummary> listAll(Long callerId, boolean isAdmin, Pageable pageable);

    /** Panel : un guide par id (brouillons inclus). Un rédacteur n'ouvre que les siens (403). */
    GuideResponse getById(Long id, Long callerId, boolean isAdmin);

    GuideResponse create(Long authorId, CreateGuideRequest request);

    /** Un rédacteur ne modifie que ses propres guides (403) ; publication libre (option A). */
    GuideResponse update(Long id, Long callerId, boolean isAdmin, CreateGuideRequest request);

    void delete(Long id, Long callerId, boolean isAdmin);
}
