package be.freenote.service.impl;

import be.freenote.dto.request.CreateDocumentRequest;
import be.freenote.dto.request.UpdateDocumentRequest;
import be.freenote.dto.response.DocumentResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.entity.*;
import be.freenote.enums.ActivityType;
import be.freenote.enums.Category;
import be.freenote.exception.DuplicateResourceException;
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
        // ── Phase 1: no DB access ──────────────────────────────────────────────────────────────
        // Do every slow, connection-free step (CPU-heavy image→PDF conversion / PDF validation,
        // enum check, and the MinIO upload) BEFORE the first repository call. Hibernate borrows the
        // JDBC connection lazily on the first SQL statement, so keeping all I/O above that line means
        // the pooled connection is never held during the conversion or the object-store upload —
        // only across the quick INSERT below. Reordered (was: fetch user/course, then upload).

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

        // Validate category against enum (no DB) before the upload, so a bad category can't orphan a file.
        Category category;
        try {
            category = Category.valueOf(request.getCategory());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid category: " + request.getCategory());
        }

        // Content fingerprint for exact-duplicate detection (checked in phase 2, before the INSERT).
        String fileHash = sha256Hex(pdfBytes);

        String fileKey = UUID.randomUUID() + "/" + FileUtil.sanitizeFileName(originalFilename);
        minioService.upload(fileKey, new ByteArrayInputStream(pdfBytes), pdfBytes.length, PDF_CONTENT_TYPE);

        // ── Phase 2: DB transaction ────────────────────────────────────────────────────────────
        // Reject an exact-duplicate PDF (same content hash). Done here rather than before the upload
        // so the object-store upload stays connection-free; the rare duplicate's orphan object is
        // cleaned up. Works against pre-existing docs once DocumentHashBackfill has run.
        documentRepository.findFirstByFileHash(fileHash).ifPresent(existing -> {
            minioService.delete(fileKey);
            throw new DuplicateResourceException("Ce document existe déjà : « " + existing.getTitle() + " ».");
        });

        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        Course course = Repositories.findByIdOrThrow(courseRepository, request.getCourseId(), "Course");

        Professor professor = null;
        if (request.getProfessorId() != null) {
            professor = Repositories.findByIdOrThrow(professorRepository, request.getProfessorId(), "Professor");
        }

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
                .fileHash(fileHash)
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
    @Transactional(readOnly = true)
    public boolean titleExists(String title, Long courseId) {
        if (title == null || title.isBlank() || courseId == null) {
            return false;
        }
        return documentRepository.existsByTitleIgnoreCaseAndCourseId(title.trim(), courseId);
    }

    /** SHA-256 of the PDF bytes, lowercase hex (64 chars) — the content fingerprint for de-duplication. */
    public static String sha256Hex(byte[] bytes) {
        try {
            byte[] digest = java.security.MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder sb = new StringBuilder(64);
            for (byte b : digest) {
                sb.append(Character.forDigit((b >> 4) & 0xf, 16)).append(Character.forDigit(b & 0xf, 16));
            }
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e); // never happens on a JVM
        }
    }

    @Override
    public DocumentResponse getById(Long id) {
        Document document = Repositories.findByIdOrThrow(documentRepository, id, "Document");
        return documentMapper.toResponse(document);
    }

    @Override
    public PageResponse<DocumentResponse> search(String query, Long sectionId, Long courseId, String category,
                                                   String sort, Pageable pageable) {
        // Validate up front for BOTH paths: the DB path needs the enum anyway, and the Meilisearch
        // path must never receive a raw user string (category is concatenated into the filter
        // expression, sort into the sort array). Clean 400s without internal messages.
        Category cat = parseCategory(category);
        String safeSort = parseSort(sort);

        if (query != null && !query.isBlank()) {
            MeilisearchService.SearchResult result = meilisearchService.search(
                    query, sectionId, courseId, cat != null ? cat.name() : null, safeSort, pageable);
            List<Long> ids = result.ids();
            if (ids.isEmpty()) {
                return new PageResponse<>(List.of(), pageable.getPageNumber(), pageable.getPageSize(), 0, 0);
            }
            // Preserve Meilisearch relevance/sort ordering — the batch fetch returns rows in DB order.
            Map<Long, Document> byId = documentRepository.findAllByIdWithAssociations(ids).stream()
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

        Page<Document> page = documentRepository.findFiltered(sectionId, courseId, cat, pageable);

        List<DocumentResponse> content = page.getContent().stream()
                .map(documentMapper::toResponse)
                .toList();
        return PageResponse.from(page, content);
    }

    /** Sorts acceptés par la recherche — doit rester un sous-ensemble des attributs `sortable`
     *  configurés dans MeilisearchServiceImpl.initIndex (verifiedRank est géré côté serveur). */
    private static final Set<String> ALLOWED_SORTS = Set.of(
            "createdAt:asc", "createdAt:desc",
            "downloadCount:asc", "downloadCount:desc",
            "averageRating:asc", "averageRating:desc");

    /** User-supplied sort → whitelisted value, or a clean 400 (never forwarded raw to Meilisearch). */
    private static String parseSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return null;
        }
        if (!ALLOWED_SORTS.contains(sort)) {
            throw new IllegalArgumentException("Tri invalide");
        }
        return sort;
    }

    /** User-supplied category filter → enum, or a clean 400 that doesn't leak the enum class name. */
    private static Category parseCategory(String category) {
        if (category == null || category.isBlank()) {
            return null;
        }
        try {
            return Category.valueOf(category);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Catégorie invalide");
        }
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

        documentRepository.delete(document);
        cleanupStorageAfterCommit(document.getFileKey(), document.getId());
        statsService.invalidateCache();
        log.info("Document deleted: id={}, by user={}", documentId, userId);
        activityLogService.log(ActivityType.DOC_DELETE, userId, user.getUsername(), document.getTitle());
    }

    /** Removes the stored PDF + search index entry only once the DB delete has committed. Doing it
     *  before commit risks the worse failure mode: a DB rollback would leave a live document row
     *  pointing at a deleted object. If this cleanup itself fails, we only orphan a MinIO object /
     *  stale index entry — harmless and re-syncable (reindexIfNeeded), so it is best-effort. */
    private void cleanupStorageAfterCommit(String fileKey, Long documentId) {
        if (!org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive()) {
            // Pas de transaction active (tests unitaires Mockito, appel hors proxy) : nettoyer tout de suite.
            minioService.delete(fileKey);
            meilisearchService.deleteDocument(documentId);
            return;
        }
        org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                new org.springframework.transaction.support.TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        minioService.delete(fileKey);
                        meilisearchService.deleteDocument(documentId);
                    }
                });
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
                ? documentRepository.findPopularWithAssociations(org.springframework.data.domain.PageRequest.of(0, 10))
                : documentRepository.findPopularPrioritizingSection(sectionId, org.springframework.data.domain.PageRequest.of(0, 10));
        return docs.stream()
                .map(documentMapper::toResponse)
                .toList();
    }

    @Override
    public PageResponse<DocumentResponse> getUnverified(Pageable pageable) {
        Page<Document> page = documentRepository.findPendingForReview(pageable);
        return PageResponse.from(page, page.getContent().stream().map(documentMapper::toResponse).toList());
    }

    @Override
    public List<List<DocumentResponse>> getDuplicateGroups() {
        return documentRepository.findDuplicateHashes().stream()
                .map(hash -> documentRepository.findAllByFileHash(hash).stream()
                        .map(documentMapper::toResponse)
                        .toList())
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
        documentRepository.delete(document);
        cleanupStorageAfterCommit(document.getFileKey(), document.getId());
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
