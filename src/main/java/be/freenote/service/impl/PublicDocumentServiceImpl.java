package be.freenote.service.impl;

import be.freenote.dto.response.PageResponse;
import be.freenote.dto.response.PublicDocumentSummary;
import be.freenote.entity.Document;
import be.freenote.enums.Category;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.mapper.PublicDocumentMapper;
import be.freenote.repository.DocumentRepository;
import be.freenote.service.PublicDocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PublicDocumentServiceImpl implements PublicDocumentService {

    /** Only these categories are exposed publicly — student-authored, low copyright risk.
     *  COURS/EXAMEN/SYNTHESE/TFE/EXERCICES stay strictly behind the verified-email gate. */
    private static final Set<Category> PUBLIC_CATEGORIES = EnumSet.of(Category.NOTES, Category.DIVERS);

    private final DocumentRepository documentRepository;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<PublicDocumentSummary> listExcerpts(Pageable pageable) {
        Page<Document> page = documentRepository.findPublicExcerpts(PUBLIC_CATEGORIES, pageable);
        return PageResponse.from(page, page.getContent().stream().map(PublicDocumentMapper::toSummary).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public PublicDocumentSummary getExcerpt(Long id) {
        Document doc = documentRepository.findPublicExcerptById(id, PUBLIC_CATEGORIES)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", id));
        return PublicDocumentMapper.toSummary(doc);
    }

    @Override
    @Transactional(readOnly = true)
    public be.freenote.dto.response.PublicDocumentStatus getStatus(Long id) {
        // Un lien partagé vers un doc hors catégories publiques doit dire « réservé, connecte-toi »
        // (avec son titre) plutôt qu'un faux « introuvable ». Seuls les docs vérifiés existent
        // publiquement — le titre d'un doc non relu n'est pas exposé.
        return documentRepository.findVerifiedTitleById(id)
                .map(be.freenote.dto.response.PublicDocumentStatus::reserved)
                .orElseGet(be.freenote.dto.response.PublicDocumentStatus::unknown);
    }
}
