package be.freenote.service;

import be.freenote.dto.response.PageResponse;
import be.freenote.dto.response.PublicDocumentSummary;
import org.springframework.data.domain.Pageable;

/**
 * Read-only, anonymous access to the copyright-safe slice of the catalogue (teasers only). No file,
 * no author — the full document still requires a verified ISFCE account.
 */
public interface PublicDocumentService {

    PageResponse<PublicDocumentSummary> listExcerpts(Pageable pageable);

    PublicDocumentSummary getExcerpt(Long id);

    /** « Existe mais réservé » (titre seul, docs vérifiés uniquement) ou inconnu — jamais de 404. */
    be.freenote.dto.response.PublicDocumentStatus getStatus(Long id);
}
