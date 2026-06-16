package be.freenote.service.impl;

import be.freenote.dto.request.CreateDocumentRequest;
import be.freenote.dto.request.UpdateDocumentRequest;
import be.freenote.dto.response.DocumentResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.entity.*;
import be.freenote.enums.ActivityType;
import be.freenote.enums.Category;
import be.freenote.exception.ForbiddenException;
import be.freenote.mapper.DocumentMapper;
import be.freenote.repository.*;
import be.freenote.repository.Repositories;
import be.freenote.event.XpEvent;
import be.freenote.service.ActivityLogService;
import be.freenote.service.DocumentService;
import be.freenote.service.ImageToPdfService;
import be.freenote.service.MeilisearchService;
import be.freenote.service.MinioService;
import be.freenote.service.PdfValidationService;
import be.freenote.service.StatsService;
import be.freenote.util.FileUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import lombok.extern.slf4j.Slf4j;

import java.io.ByteArrayInputStream;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DocumentServiceImpl implements DocumentService {

    private static final String PDF_CONTENT_TYPE = "application/pdf";
    private static final String DL_BUFFER_PREFIX = "dl-buffer:";

    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final CourseRepository courseRepository;
    private final ProfessorRepository professorRepository;
    private final DocumentMapper documentMapper;
    private final MinioService minioService;
    private final PdfValidationService pdfValidationService;
    private final ImageToPdfService imageToPdfService;
    private final MeilisearchService meilisearchService;
    private final StatsService statsService;
    private final ApplicationEventPublisher eventPublisher;
    private final StringRedisTemplate redisTemplate;
    private final ActivityLogService activityLogService;

    @Override
    @Transactional
    public DocumentResponse create(CreateDocumentRequest request, MultipartFile file, Long userId) {
        return create(request, file, null, userId);
    }

    @Override
    @Transactional
    public DocumentResponse create(CreateDocumentRequest request, MultipartFile file,
                                   List<MultipartFile> images, Long userId) {
        // Either a single PDF, or 1–8 JPG/PNG images assembled into one PDF (images take precedence).
        byte[] pdfBytes;
        String originalFilename;
        if (images != null && !images.isEmpty()) {
            pdfBytes = imageToPdfService.convertToPdf(images);
            originalFilename = "document.pdf";
        } else if (file != null && !file.isEmpty()) {
            pdfBytes = pdfValidationService.validate(file);
            originalFilename = file.getOriginalFilename();
        } else {
            throw new IllegalArgumentException("Aucun fichier fourni");
        }

        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        Course course = Repositories.findByIdOrThrow(courseRepository, request.getCourseId(), "Course");

        Professor professor = null;
        if (request.getProfessorId() != null) {
            professor = Repositories.findByIdOrThrow(professorRepository, request.getProfessorId(), "Professor");
        }

        // Validate category against enum
        Category category;
        try {
            category = Category.valueOf(request.getCategory());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid category: " + request.getCategory());
        }

        String fileKey = UUID.randomUUID() + "/" + FileUtil.sanitizeFileName(originalFilename);
        minioService.upload(fileKey, new ByteArrayInputStream(pdfBytes), pdfBytes.length, PDF_CONTENT_TYPE);

        Document document = Document.builder()
                .title(request.getTitle().trim())
                .course(course)
                .category(category)
                .fileKey(fileKey)
                .user(user)
                .anonymous(request.isAnonymous())
                .language(request.getLanguage())
                .aiGenerated(request.isAiGenerated())
                .year(request.getYear())
                .professor(professor)
                .fileSize((long) pdfBytes.length)
                .build();

        Document saved = documentRepository.save(document);

        meilisearchService.indexDocument(saved); // async — does not block the transaction
        statsService.invalidateCache();
        // XP is awarded when admin verifies the document, not at upload — prevents spam farming

        log.info("Document uploaded: id={}, title='{}', user={}, size={}KB",
                saved.getId(), saved.getTitle(), userId, pdfBytes.length / 1024);
        activityLogService.log(ActivityType.UPLOAD, userId, user.getUsername(), saved.getTitle());

        return documentMapper.toResponse(saved);
    }

    @Override
    public DocumentResponse getById(Long id) {
        Document document = Repositories.findByIdOrThrow(documentRepository, id, "Document");
        return documentMapper.toResponse(document);
    }

    @Override
    public PageResponse<DocumentResponse> search(String query, Long sectionId, Long courseId, String category,
                                                   String sort, Pageable pageable) {
        if (query != null && !query.isBlank()) {
            MeilisearchService.SearchResult result = meilisearchService.search(query, sectionId, courseId, category, sort, pageable);
            List<Long> ids = result.ids();
            if (ids.isEmpty()) {
                return new PageResponse<>(List.of(), pageable.getPageNumber(), pageable.getPageSize(), 0, 0);
            }
            // Preserve Meilisearch relevance/sort ordering — findAllById returns rows in DB order.
            Map<Long, Document> byId = documentRepository.findAllById(ids).stream()
                    .collect(Collectors.toMap(Document::getId, d -> d));
            List<DocumentResponse> content = ids.stream()
                    .map(byId::get)
                    .filter(java.util.Objects::nonNull)
                    .map(documentMapper::toResponse)
                    .toList();
            long total = result.total();
            int totalPages = (int) Math.ceil((double) total / pageable.getPageSize());
            return new PageResponse<>(content, pageable.getPageNumber(), pageable.getPageSize(), total, totalPages);
        }

        Category cat = category != null ? Category.valueOf(category) : null;
        Page<Document> page = documentRepository.findFiltered(sectionId, courseId, cat, pageable);

        List<DocumentResponse> content = page.getContent().stream()
                .map(documentMapper::toResponse)
                .toList();
        return PageResponse.from(page, content);
    }

    @Override
    @Transactional
    public void delete(Long documentId, Long userId) {
        Document document = Repositories.findByIdOrThrow(documentRepository, documentId, "Document");
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");

        boolean isAuthor = document.getUser() != null && document.getUser().getId().equals(userId);
        boolean isAdmin = "ADMIN".equals(user.getRole());
        if (!isAuthor && !isAdmin) {
            throw new ForbiddenException("You can only delete your own documents");
        }

        minioService.delete(document.getFileKey());
        meilisearchService.deleteDocument(document.getId());
        documentRepository.delete(document);
        statsService.invalidateCache();
        log.info("Document deleted: id={}, by user={}", documentId, userId);
        activityLogService.log(ActivityType.DOC_DELETE, userId, user.getUsername(), document.getTitle());
    }

    @Override
    @Transactional
    public DocumentResponse rename(Long documentId, Long userId, String newTitle) {
        Document document = Repositories.findByIdOrThrow(documentRepository, documentId, "Document");
        if (document.getUser() == null || !document.getUser().getId().equals(userId)) {
            throw new ForbiddenException("You can only rename your own documents");
        }
        String trimmed = newTitle == null ? "" : newTitle.trim();
        if (trimmed.isEmpty() || trimmed.length() > 50) {
            throw new IllegalArgumentException("Le titre doit faire entre 1 et 50 caractères.");
        }
        document.setTitle(trimmed);
        Document saved = documentRepository.save(document);
        meilisearchService.indexDocument(saved);
        return documentMapper.toResponse(saved);
    }

    @Override
    public List<DocumentResponse> getPopular(Long sectionId) {
        List<Document> docs = sectionId == null
                ? documentRepository.findTop10ByOrderByVerifiedDescDownloadCountDesc()
                : documentRepository.findPopularPrioritizingSection(sectionId, org.springframework.data.domain.PageRequest.of(0, 10));
        return docs.stream()
                .map(documentMapper::toResponse)
                .toList();
    }

    @Override
    public List<DocumentResponse> getUnverified() {
        return documentRepository.findByVerifiedFalse().stream()
                .map(documentMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional
    public DocumentResponse verify(Long documentId) {
        Document document = Repositories.findByIdOrThrow(documentRepository, documentId, "Document");
        document.setVerified(true);
        Document saved = documentRepository.save(document);

        // Award XP to author on verification (not at upload) — prevents spam farming
        if (document.getUser() != null) {
            eventPublisher.publishEvent(new XpEvent.DocumentVerified(document.getUser().getId(), documentId, document.getTitle()));
        }
        statsService.invalidateCache();
        activityLogService.log(ActivityType.DOC_VERIFY, null, "Admin", document.getTitle());

        return documentMapper.toResponse(saved);
    }

    @Override
    @Transactional
    public DocumentResponse adminUpdate(Long documentId, UpdateDocumentRequest request) {
        Document document = Repositories.findByIdOrThrow(documentRepository, documentId, "Document");

        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            document.setTitle(request.getTitle().trim());
        }
        if (request.getCourseId() != null) {
            Course course = Repositories.findByIdOrThrow(courseRepository, request.getCourseId(), "Course");
            document.setCourse(course);
        }
        if (request.getCategory() != null) {
            document.setCategory(Category.valueOf(request.getCategory()));
        }
        if (request.getLanguage() != null) {
            document.setLanguage(request.getLanguage());
        }
        if (request.getYear() != null) {
            document.setYear(request.getYear());
        }
        if (request.getVerified() != null) {
            document.setVerified(request.getVerified());
        }
        if (request.getProfessorId() != null) {
            Professor professor = Repositories.findByIdOrThrow(professorRepository, request.getProfessorId(), "Professor");
            document.setProfessor(professor);
        }
        Document saved = documentRepository.save(document);
        meilisearchService.indexDocument(saved);
        return documentMapper.toResponse(saved);
    }

    @Override
    @Transactional
    public void adminDelete(Long documentId) {
        Document document = Repositories.findByIdOrThrow(documentRepository, documentId, "Document");
        minioService.delete(document.getFileKey());
        meilisearchService.deleteDocument(document.getId());
        documentRepository.delete(document);
        statsService.invalidateCache();
        activityLogService.log(ActivityType.DOC_DELETE, null, "Admin", document.getTitle());
    }

    // --- Download with Redis buffer ---

    @Override
    public byte[] download(Long documentId, Long userId) {
        Document document = Repositories.findByIdOrThrow(documentRepository, documentId, "Document");

        // Buffer in Redis — no DB write on each download
        redisTemplate.opsForValue().increment(DL_BUFFER_PREFIX + documentId);

        // Award 1 XP to author — skip if downloader is the author (anti-farming)
        if (document.getUser() != null && !document.getUser().getId().equals(userId)) {
            eventPublisher.publishEvent(new XpEvent.DocumentDownloaded(document.getUser().getId(), documentId));
        }

        return minioService.download(document.getFileKey());
    }

    @Override
    public PageResponse<DocumentResponse> getByUser(Long userId, Pageable pageable) {
        Page<Document> page = documentRepository.findByUserIdAndVerifiedTrue(userId, pageable);
        List<DocumentResponse> content = page.getContent().stream()
                .map(documentMapper::toResponse)
                .toList();
        return PageResponse.from(page, content);
    }

    /** Flush buffered download counts to DB every 5 minutes */
    @Scheduled(fixedRate = 300_000)
    @Transactional
    public void flushDownloadCounts() {
        var scanOptions = org.springframework.data.redis.core.ScanOptions.scanOptions()
                .match(DL_BUFFER_PREFIX + "*").count(100).build();

        try (var cursor = redisTemplate.scan(scanOptions)) {
            while (cursor.hasNext()) {
                String key = cursor.next();
                String value = redisTemplate.opsForValue().getAndDelete(key);
                if (value == null) continue;

                long increment = Long.parseLong(value);
                Long docId = Long.parseLong(key.substring(DL_BUFFER_PREFIX.length()));
                documentRepository.incrementDownloadCount(docId, (int) increment);
            }
        }
    }
}
