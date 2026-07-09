package be.freenote.service;

import be.freenote.dto.response.PageResponse;
import be.freenote.dto.response.PublicDocumentSummary;
import org.springframework.data.domain.Pageable;

/**
 * Read-only, anonymous access to the copyright-safe slice of the catalogue (teasers only). No file,
 * no author — the full document still requires a verified ISFCE account.
 */
public interface PublicDocumentService {

    /** {@code courseId} optionnel (null = tout le catalogue public) — étendu au groupe d'équivalence V15. */
    PageResponse<PublicDocumentSummary> listExcerpts(Pageable pageable, Long courseId);

    PublicDocumentSummary getExcerpt(Long id);

    /** « Existe mais réservé » (titre seul, docs vérifiés uniquement) ou inconnu — jamais de 404. */
    be.freenote.dto.response.PublicDocumentStatus getStatus(Long id);

    /** Teaser public d'un cours (page /courses/{id} anonyme — SEO). */
    be.freenote.dto.response.PublicCourseResponse getCourse(Long id);

    /** Ids des cours ayant au moins un doc public — sitemap (jamais de page cours vide indexée). */
    java.util.List<Long> publicCourseIds();
}
