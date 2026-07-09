package be.freenote.service.impl;

import be.freenote.dto.response.PageResponse;
import be.freenote.dto.response.PublicCourseResponse;
import be.freenote.dto.response.PublicDocumentSummary;
import be.freenote.entity.Course;
import be.freenote.entity.Document;
import be.freenote.enums.Category;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.mapper.PublicDocumentMapper;
import be.freenote.repository.CourseRepository;
import be.freenote.repository.DocumentRepository;
import be.freenote.repository.Repositories;
import be.freenote.service.CourseEquivalenceService;
import be.freenote.service.PublicDocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PublicDocumentServiceImpl implements PublicDocumentService {

    /** Only these categories are exposed publicly — student-authored, low copyright risk.
     *  COURS/EXAMEN/SYNTHESE/TFE/EXERCICES stay strictly behind the verified-email gate. */
    private static final Set<Category> PUBLIC_CATEGORIES = EnumSet.of(Category.NOTES, Category.DIVERS);

    private final DocumentRepository documentRepository;
    private final CourseRepository courseRepository;
    private final CourseEquivalenceService courseEquivalenceService;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<PublicDocumentSummary> listExcerpts(Pageable pageable, Long courseId) {
        List<Long> courseIds = courseEquivalenceService.expand(courseId);
        Page<Document> page = courseIds == null
                ? documentRepository.findPublicExcerpts(PUBLIC_CATEGORIES, pageable)
                : documentRepository.findPublicExcerptsByCourse(PUBLIC_CATEGORIES, courseIds, pageable);
        return PageResponse.from(page, page.getContent().stream().map(PublicDocumentMapper::toSummary).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public PublicCourseResponse getCourse(Long id) {
        Course course = Repositories.findByIdOrThrow(courseRepository, id, "Course");
        List<Long> courseIds = courseEquivalenceService.expand(id);
        return new PublicCourseResponse(
                course.getId(),
                course.getName(),
                course.getSection().getName(),
                documentRepository.countVerifiedByCourseIds(courseIds),
                documentRepository.countPublicByCourseIds(PUBLIC_CATEGORIES, courseIds));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Long> publicCourseIds() {
        return documentRepository.findCourseIdsWithPublicDocs(PUBLIC_CATEGORIES);
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
        // publiquement — le titre d'un doc non relu n'est pas exposé. Le flag publiclyVisible évite
        // au frontend de tenter le teaser complet (et son 404 console) sur un doc réservé.
        return documentRepository.findById(id)
                .filter(Document::isVerified)
                .map(doc -> PUBLIC_CATEGORIES.contains(doc.getCategory())
                        ? be.freenote.dto.response.PublicDocumentStatus.visible(doc.getTitle())
                        : be.freenote.dto.response.PublicDocumentStatus.reserved(doc.getTitle()))
                .orElseGet(be.freenote.dto.response.PublicDocumentStatus::unknown);
    }
}
