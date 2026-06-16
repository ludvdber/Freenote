package be.freenote.service;

import be.freenote.dto.request.CreateDocumentRequest;
import be.freenote.dto.request.UpdateDocumentRequest;
import be.freenote.dto.response.DocumentResponse;
import be.freenote.entity.*;
import be.freenote.enums.Category;
import be.freenote.event.XpEvent;
import be.freenote.exception.ForbiddenException;
import be.freenote.exception.PayloadTooLargeException;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.mapper.DocumentMapper;
import be.freenote.repository.*;
import be.freenote.service.impl.DocumentServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocumentServiceImplTest {

    @Mock private DocumentRepository documentRepository;
    @Mock private UserRepository userRepository;
    @Mock private CourseRepository courseRepository;
    @Mock private ProfessorRepository professorRepository;
    @Mock private DocumentMapper documentMapper;
    @Mock private MinioService minioService;
    @Mock private PdfValidationService pdfValidationService;
    @Mock private ImageToPdfService imageToPdfService;
    @Mock private MeilisearchService meilisearchService;
    @Mock private StatsService statsService;
    @Mock private ActivityLogService activityLogService;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;

    @InjectMocks private DocumentServiceImpl documentService;

    private static final byte[] VALID_PDF_BYTES = new byte[]{0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34};

    private User testUser() {
        return User.builder().id(1L).username("author").role("USER").build();
    }

    private Course testCourse() {
        Section section = Section.builder().id(1L).name("IT").build();
        return Course.builder().id(10L).name("Java").section(section).build();
    }

    private Document testDocument(User user) {
        return Document.builder()
                .id(100L).title("Test Doc").course(testCourse()).category(Category.SYNTHESE)
                .fileKey("uuid/test.pdf").user(user).language("FR").fileSize(5000L)
                .build();
    }

    private DocumentResponse dummyResponse() {
        return new DocumentResponse(100L, "Test Doc", 1L, "Java", "IT", "SYNTHESE",
                "author", null, false, false, "FR", null, null, 0.0, 0,
                LocalDateTime.now());
    }

    private CreateDocumentRequest validRequest() {
        CreateDocumentRequest req = new CreateDocumentRequest();
        req.setTitle("Test Doc");
        req.setCourseId(10L);
        req.setCategory("SYNTHESE");
        req.setLanguage("FR");
        return req;
    }

    // ---- create ----

    @Test
    void shouldCreateDocumentWhenValidPdf() {
        MultipartFile file = mock(MultipartFile.class);
        when(file.getOriginalFilename()).thenReturn("test.pdf");
        CreateDocumentRequest req = validRequest();
        User user = testUser();
        Course course = testCourse();

        when(pdfValidationService.validate(file)).thenReturn(VALID_PDF_BYTES);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(courseRepository.findById(10L)).thenReturn(Optional.of(course));
        when(documentRepository.save(any(Document.class))).thenAnswer(inv -> {
            Document d = inv.getArgument(0);
            d.setId(100L);
            return d;
        });
        when(documentMapper.toResponse(any(Document.class))).thenReturn(dummyResponse());

        DocumentResponse response = documentService.create(req, file, 1L);

        assertThat(response).isNotNull();
        verify(minioService).upload(anyString(), any(), anyLong(), eq("application/pdf"));
        verify(meilisearchService).indexDocument(any(Document.class));
        // XP is awarded on verify(), not create() — prevents spam farming
        verify(eventPublisher, never()).publishEvent(any(XpEvent.class));
    }

    @Test
    void shouldCreateDocumentFromImages() {
        // Image-upload path: 1–8 JPG/PNG are assembled into one PDF by ImageToPdfService; the PDF
        // validator is bypassed and the resulting bytes are stored as application/pdf.
        MultipartFile image = mock(MultipartFile.class);
        List<MultipartFile> images = List.of(image);
        CreateDocumentRequest req = validRequest();

        when(imageToPdfService.convertToPdf(images)).thenReturn(VALID_PDF_BYTES);
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser()));
        when(courseRepository.findById(10L)).thenReturn(Optional.of(testCourse()));
        when(documentRepository.save(any(Document.class))).thenAnswer(inv -> {
            Document d = inv.getArgument(0);
            d.setId(100L);
            return d;
        });
        when(documentMapper.toResponse(any(Document.class))).thenReturn(dummyResponse());

        DocumentResponse response = documentService.create(req, null, images, 1L);

        assertThat(response).isNotNull();
        verify(imageToPdfService).convertToPdf(images);
        verify(pdfValidationService, never()).validate(any());
        verify(minioService).upload(anyString(), any(), anyLong(), eq("application/pdf"));
    }

    @Test
    void shouldThrowWhenNeitherFileNorImagesProvided() {
        assertThatThrownBy(() -> documentService.create(validRequest(), null, null, 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("fichier");

        verify(minioService, never()).upload(anyString(), any(), anyLong(), anyString());
    }

    @Test
    void shouldThrowWhenPdfValidationFails() {
        MultipartFile file = mock(MultipartFile.class);
        when(pdfValidationService.validate(file))
                .thenThrow(new IllegalArgumentException("Only PDF files are accepted"));

        assertThatThrownBy(() -> documentService.create(validRequest(), file, 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("PDF");
    }

    @Test
    void shouldThrowWhenFileTooLarge() {
        MultipartFile file = mock(MultipartFile.class);
        when(pdfValidationService.validate(file))
                .thenThrow(new PayloadTooLargeException("File size exceeds the 10 MB limit"));

        assertThatThrownBy(() -> documentService.create(validRequest(), file, 1L))
                .isInstanceOf(PayloadTooLargeException.class)
                .hasMessageContaining("10 MB");
    }

    @Test
    void shouldThrowWhenCategoryInvalid() {
        MultipartFile file = mock(MultipartFile.class);
        CreateDocumentRequest req = validRequest();
        req.setCategory("INVALID_CAT");

        when(pdfValidationService.validate(file)).thenReturn(VALID_PDF_BYTES);
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser()));
        when(courseRepository.findById(10L)).thenReturn(Optional.of(testCourse()));

        assertThatThrownBy(() -> documentService.create(req, file, 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid category");
    }

    @Test
    void shouldStoreTitleTrimmedNotHtmlEscaped() {
        // Titles are stored raw (only trimmed) — React escapes at render time, so escaping here
        // would only double-encode (an apostrophe would surface as &#x27; in the UI).
        MultipartFile file = mock(MultipartFile.class);
        when(file.getOriginalFilename()).thenReturn("test.pdf");
        CreateDocumentRequest req = validRequest();
        req.setTitle("  L'algo & data  ");

        when(pdfValidationService.validate(file)).thenReturn(VALID_PDF_BYTES);
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser()));
        when(courseRepository.findById(10L)).thenReturn(Optional.of(testCourse()));
        when(documentRepository.save(any(Document.class))).thenAnswer(inv -> {
            Document d = inv.getArgument(0);
            d.setId(100L);
            return d;
        });
        when(documentMapper.toResponse(any(Document.class))).thenReturn(dummyResponse());

        documentService.create(req, file, 1L);

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(documentRepository, atLeastOnce()).save(captor.capture());
        String savedTitle = captor.getAllValues().getFirst().getTitle();
        assertThat(savedTitle).isEqualTo("L'algo & data");
        assertThat(savedTitle).doesNotContain("&amp;").doesNotContain("&#x27;");
    }

    // ---- delete ----

    @Test
    void shouldDeleteDocumentWhenAuthor() {
        User author = testUser();
        Document doc = testDocument(author);

        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));
        when(userRepository.findById(1L)).thenReturn(Optional.of(author));

        documentService.delete(100L, 1L);

        verify(minioService).delete("uuid/test.pdf");
        verify(meilisearchService).deleteDocument(100L);
        verify(documentRepository).delete(doc);
    }

    @Test
    void shouldDeleteDocumentWhenAdmin() {
        User admin = User.builder().id(99L).username("admin").role("ADMIN").build();
        User author = testUser();
        Document doc = testDocument(author);

        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));
        when(userRepository.findById(99L)).thenReturn(Optional.of(admin));

        documentService.delete(100L, 99L);

        verify(documentRepository).delete(doc);
    }

    @Test
    void shouldThrowForbiddenWhenNotAuthorNorAdmin() {
        User other = User.builder().id(50L).username("other").role("USER").build();
        Document doc = testDocument(testUser());

        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));
        when(userRepository.findById(50L)).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> documentService.delete(100L, 50L))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void shouldThrowNotFoundWhenDeletingNonExistentDocument() {
        when(documentRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> documentService.delete(999L, 1L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ---- download ----

    @Test
    void shouldIncrementRedisCounterOnDownload() {
        Document doc = testDocument(testUser());
        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(minioService.download("uuid/test.pdf")).thenReturn(new byte[]{1, 2, 3});

        documentService.download(100L, 50L);

        verify(valueOps).increment("dl-buffer:100");
    }

    @Test
    void shouldPublishXpEventWhenOtherUserDownloads() {
        User author = testUser();
        Document doc = testDocument(author);

        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(minioService.download("uuid/test.pdf")).thenReturn(new byte[]{1, 2, 3});

        documentService.download(100L, 50L);

        verify(eventPublisher).publishEvent(any(XpEvent.DocumentDownloaded.class));
    }

    @Test
    void shouldNotPublishXpEventWhenSelfDownload() {
        User author = testUser();
        Document doc = testDocument(author);

        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(minioService.download("uuid/test.pdf")).thenReturn(new byte[]{1, 2, 3});

        documentService.download(100L, 1L);

        verify(eventPublisher, never()).publishEvent(any(XpEvent.class));
    }

    @Test
    void shouldNotPublishXpEventWhenDocumentHasNoAuthor() {
        Document doc = testDocument(null);

        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(minioService.download("uuid/test.pdf")).thenReturn(new byte[]{1, 2, 3});

        documentService.download(100L, 50L);

        verify(eventPublisher, never()).publishEvent(any(XpEvent.class));
    }

    @Test
    void shouldReturnFileBytes() {
        Document doc = testDocument(null);
        byte[] expected = {10, 20, 30};

        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(minioService.download("uuid/test.pdf")).thenReturn(expected);

        byte[] result = documentService.download(100L, 50L);

        assertThat(result).isEqualTo(expected);
    }

    // ---- flushDownloadCounts ----

    @SuppressWarnings("unchecked")
    @Test
    void shouldFlushDownloadCountsToDatabase() {
        var cursor = mock(org.springframework.data.redis.core.Cursor.class);
        when(cursor.hasNext()).thenReturn(true, true, false);
        when(cursor.next()).thenReturn("dl-buffer:1", "dl-buffer:2");
        when(redisTemplate.scan(any(org.springframework.data.redis.core.ScanOptions.class))).thenReturn(cursor);
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.getAndDelete("dl-buffer:1")).thenReturn("5");
        when(valueOps.getAndDelete("dl-buffer:2")).thenReturn("12");

        documentService.flushDownloadCounts();

        verify(documentRepository).incrementDownloadCount(1L, 5);
        verify(documentRepository).incrementDownloadCount(2L, 12);
    }

    @Test
    @SuppressWarnings("unchecked")
    void shouldHandleEmptyKeysOnFlush() {
        org.springframework.data.redis.core.Cursor<String> emptyCursor = mock(org.springframework.data.redis.core.Cursor.class);
        when(emptyCursor.hasNext()).thenReturn(false);
        when(redisTemplate.scan(any(org.springframework.data.redis.core.ScanOptions.class))).thenReturn(emptyCursor);

        documentService.flushDownloadCounts();

        verify(documentRepository, never()).incrementDownloadCount(anyLong(), anyInt());
    }

    @Test
    @SuppressWarnings("unchecked")
    void shouldSkipNullValueOnFlush() {
        org.springframework.data.redis.core.Cursor<String> cursor = mock(org.springframework.data.redis.core.Cursor.class);
        when(cursor.hasNext()).thenReturn(true, false);
        when(cursor.next()).thenReturn("dl-buffer:1");
        when(redisTemplate.scan(any(org.springframework.data.redis.core.ScanOptions.class))).thenReturn(cursor);
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.getAndDelete("dl-buffer:1")).thenReturn(null);

        documentService.flushDownloadCounts();

        verify(documentRepository, never()).incrementDownloadCount(anyLong(), anyInt());
    }

    // ---- verify ----

    @Test
    void shouldVerifyDocument() {
        Document doc = testDocument(testUser());
        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));
        when(documentRepository.save(doc)).thenReturn(doc);
        when(documentMapper.toResponse(doc)).thenReturn(dummyResponse());

        documentService.verify(100L);

        assertThat(doc.isVerified()).isTrue();
        verify(documentRepository).save(doc);
        verify(eventPublisher).publishEvent(any(XpEvent.DocumentVerified.class));
    }

    // ---- adminUpdate ----

    @Test
    void shouldAdminUpdateTitle() {
        Document doc = testDocument(testUser());
        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));
        when(documentRepository.save(any(Document.class))).thenAnswer(inv -> inv.getArgument(0));
        when(documentMapper.toResponse(any(Document.class))).thenReturn(dummyResponse());

        UpdateDocumentRequest req = new UpdateDocumentRequest();
        req.setTitle("New Title");

        documentService.adminUpdate(100L, req);

        assertThat(doc.getTitle()).isEqualTo("New Title");
        verify(meilisearchService).indexDocument(doc);
    }

    @Test
    void shouldAdminUpdateOnlyNonNullFields() {
        Document doc = testDocument(testUser());
        doc.setLanguage("FR");
        doc.setYear("2024");

        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));
        when(documentRepository.save(any(Document.class))).thenAnswer(inv -> inv.getArgument(0));
        when(documentMapper.toResponse(any(Document.class))).thenReturn(dummyResponse());

        UpdateDocumentRequest req = new UpdateDocumentRequest();
        req.setLanguage("EN");
        // title, category, year, tags are null → should not change

        documentService.adminUpdate(100L, req);

        assertThat(doc.getLanguage()).isEqualTo("EN");
        assertThat(doc.getYear()).isEqualTo("2024"); // unchanged
        assertThat(doc.getTitle()).isEqualTo("Test Doc"); // unchanged
    }

    @Test
    void shouldThrowWhenAdminUpdateWithInvalidCategory() {
        Document doc = testDocument(testUser());
        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));

        UpdateDocumentRequest req = new UpdateDocumentRequest();
        req.setCategory("FAKE");

        assertThatThrownBy(() -> documentService.adminUpdate(100L, req))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ---- adminDelete ----

    @Test
    void shouldAdminDeleteDocument() {
        Document doc = testDocument(testUser());
        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));

        documentService.adminDelete(100L);

        verify(minioService).delete("uuid/test.pdf");
        verify(meilisearchService).deleteDocument(100L);
        verify(documentRepository).delete(doc);
    }

    @Test
    void shouldThrowNotFoundOnAdminDeleteWhenMissing() {
        when(documentRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> documentService.adminDelete(999L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ---- getById ----

    @Test
    void shouldReturnDocumentResponseById() {
        Document doc = testDocument(testUser());
        DocumentResponse resp = dummyResponse();

        when(documentRepository.findById(100L)).thenReturn(Optional.of(doc));
        when(documentMapper.toResponse(doc)).thenReturn(resp);

        DocumentResponse result = documentService.getById(100L);

        assertThat(result).isEqualTo(resp);
    }

    @Test
    void shouldThrowNotFoundWhenDocumentDoesNotExist() {
        when(documentRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> documentService.getById(999L))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
