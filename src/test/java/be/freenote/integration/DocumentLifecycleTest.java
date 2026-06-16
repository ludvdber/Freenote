package be.freenote.integration;

import be.freenote.entity.*;
import be.freenote.service.MeilisearchService;
import be.freenote.service.MinioService;
import be.freenote.service.impl.DocumentServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("integration")
class DocumentLifecycleTest extends AbstractIntegrationTest {

    // External services mocked — we test persistence, not file storage
    @MockitoBean private MinioService minioService;
    @MockitoBean private MeilisearchService meilisearchService;

    @Autowired private DocumentServiceImpl documentServiceImpl;

    private User verifiedUser;
    private Section section;
    private Course course;
    private String jwt;

    @BeforeEach
    void setUp() {
        // Clean all data in correct order (respecting FK constraints)
        ratingRepository.deleteAll();
        favoriteRepository.deleteAll();
        donationRepository.deleteAll();
        documentRepository.deleteAll();
        courseRepository.deleteAll();
        sectionRepository.deleteAll();
        userRepository.deleteAll();
        // Clear Redis
        var keys = redisTemplate.keys("*");
        if (keys != null && !keys.isEmpty()) redisTemplate.delete(keys);

        verifiedUser = createVerifiedUser("doctest-user");
        section = createSection("IT-doctest");
        course = createCourse("Algo", section, verifiedUser);
        jwt = jwtFor(verifiedUser);
    }

    @Test
    void shouldUploadPdfAndPersistMetadata() throws Exception {
        // Minimal valid PDF bytes
        byte[] pdfBytes = "%PDF-1.4 minimal test content".getBytes();

        // MinIO upload returns the object key
        when(minioService.upload(anyString(), any(InputStream.class), anyLong(), anyString()))
                .thenReturn("test/algo-notes.pdf");

        String jsonData = """
                {
                    "title": "Algo Notes",
                    "courseId": %d,
                    "category": "SYNTHESE",
                    "language": "FR",
                    "aiGenerated": false,
                    "anonymous": false
                }
                """.formatted(course.getId());

        MockMultipartFile file = new MockMultipartFile(
                "file", "algo-notes.pdf", "application/pdf", pdfBytes);
        MockMultipartFile data = new MockMultipartFile(
                "data", "", "application/json", jsonData.getBytes());

        mockMvc.perform(multipart("/api/documents")
                        .file(file)
                        .file(data)
                        .header("Authorization", "Bearer " + jwt)
                        .with(csrf())
                        .contentType(MediaType.MULTIPART_FORM_DATA))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Algo Notes"))
                .andExpect(jsonPath("$.courseName").value("Algo"))
                .andExpect(jsonPath("$.category").value("SYNTHESE"));

        // Verify persistence
        var docs = documentRepository.findAll();
        assertThat(docs).hasSize(1);
        Document doc = docs.getFirst();
        assertThat(doc.getTitle()).isEqualTo("Algo Notes");
        assertThat(doc.getDownloadCount()).isZero();
        assertThat(doc.getFileKey()).isNotNull();
        assertThat(doc.getUser().getId()).isEqualTo(verifiedUser.getId());

        // XP is only awarded when an admin verifies the document (not at upload) to prevent spam farming.
        User refreshed = userRepository.findById(verifiedUser.getId()).orElseThrow();
        assertThat(refreshed.getXp()).isZero();
    }

    @Test
    void shouldAssembleUploadedImagesIntoPdf() throws Exception {
        // The image→PDF path runs the real ImageToPdfService (PDFBox) end-to-end; only MinIO is mocked.
        when(minioService.upload(anyString(), any(InputStream.class), anyLong(), anyString()))
                .thenReturn("test/scan.pdf");

        String jsonData = """
                {
                    "title": "Scan Examen",
                    "courseId": %d,
                    "category": "EXAMEN",
                    "language": "FR",
                    "aiGenerated": false,
                    "anonymous": false
                }
                """.formatted(course.getId());

        MockMultipartFile data = new MockMultipartFile(
                "data", "", "application/json", jsonData.getBytes());
        MockMultipartFile img1 = new MockMultipartFile(
                "images", "p1.png", "image/png", imageBytes(600, 800, "png"));
        MockMultipartFile img2 = new MockMultipartFile(
                "images", "p2.jpg", "image/jpeg", imageBytes(1000, 700, "jpg"));

        mockMvc.perform(multipart("/api/documents")
                        .file(img1)
                        .file(img2)
                        .file(data)
                        .header("Authorization", "Bearer " + jwt)
                        .with(csrf())
                        .contentType(MediaType.MULTIPART_FORM_DATA))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Scan Examen"))
                .andExpect(jsonPath("$.category").value("EXAMEN"));

        var docs = documentRepository.findAll();
        assertThat(docs).hasSize(1);
        Document doc = docs.getFirst();
        assertThat(doc.getFileSize()).isPositive();

        // A real, non-empty PDF (not the raw images) was handed to storage.
        verify(minioService).upload(anyString(), any(InputStream.class), longThat(len -> len > 0L), eq("application/pdf"));
    }

    private byte[] imageBytes(int w, int h, String format) throws IOException {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.BLUE);
        g.fillRect(0, 0, w, h);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, format, out);
        return out.toByteArray();
    }

    @Test
    void shouldRateDocumentAndUpdateDenormalized() throws Exception {
        Document doc = createDocument("Rate Me", course, verifiedUser);

        // Create a second user to rate (can't rate own doc for XP, but rating itself works)
        User rater = createVerifiedUser("rater-user");
        String raterJwt = jwtFor(rater);

        mockMvc.perform(post("/api/documents/{docId}/ratings", doc.getId())
                        .header("Authorization", "Bearer " + raterJwt)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"score": 4}
                                """))
                .andExpect(status().isOk());

        // Verify rating entity
        var ratings = ratingRepository.findAll();
        assertThat(ratings).hasSize(1);
        assertThat(ratings.getFirst().getScore()).isEqualTo(4);

        // Verify denormalized fields on document
        Document refreshed = documentRepository.findById(doc.getId()).orElseThrow();
        assertThat(refreshed.getAverageRating()).isEqualByComparingTo(new BigDecimal("4.00"));
        assertThat(refreshed.getRatingCount()).isEqualTo(1);

        // Verify XP awarded to doc author (2 * 4 = 8 XP)
        User author = userRepository.findById(verifiedUser.getId()).orElseThrow();
        assertThat(author.getXp()).isEqualTo(8);
    }

    @Test
    void shouldToggleFavorite() throws Exception {
        Document doc = createDocument("Fav Me", course, verifiedUser);

        // Add favorite
        mockMvc.perform(post("/api/favorites/{docId}", doc.getId())
                        .header("Authorization", "Bearer " + jwt)
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isFavorite").value(true));

        assertThat(favoriteRepository.existsByUserIdAndDocumentId(verifiedUser.getId(), doc.getId()))
                .isTrue();

        // Remove favorite (toggle)
        mockMvc.perform(post("/api/favorites/{docId}", doc.getId())
                        .header("Authorization", "Bearer " + jwt)
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isFavorite").value(false));

        assertThat(favoriteRepository.existsByUserIdAndDocumentId(verifiedUser.getId(), doc.getId()))
                .isFalse();
    }

    @Test
    void shouldAnonymizeDocOnAccountDeletion() throws Exception {
        Document doc = createDocument("Orphan Doc", course, verifiedUser);
        Long docId = doc.getId();
        Long courseId = course.getId();

        mockMvc.perform(delete("/api/users/me")
                        .header("Authorization", "Bearer " + jwt)
                        .with(csrf()))
                .andExpect(status().isNoContent());

        // Document still exists but is anonymized
        Document orphan = documentRepository.findById(docId).orElseThrow();
        assertThat(orphan.getUser()).isNull();
        assertThat(orphan.isAnonymous()).isTrue();

        // Course still exists but createdBy is null
        Course orphanCourse = courseRepository.findById(courseId).orElseThrow();
        assertThat(orphanCourse.getCreatedBy()).isNull();

        // User is gone
        assertThat(userRepository.findById(verifiedUser.getId())).isEmpty();
    }

    @Test
    void shouldFlushRedisDownloadCountsToDatabase() throws Exception {
        Document doc = createDocument("Download Me", course, verifiedUser);
        Long docId = doc.getId();

        // Simulate 5 buffered downloads in Redis
        redisTemplate.opsForValue().set("dl-buffer:" + docId, "5");

        // Trigger flush directly via the impl (scheduled method, not on the interface)
        documentServiceImpl.flushDownloadCounts();

        // DB counter should now be 5
        Document refreshed = documentRepository.findById(docId).orElseThrow();
        assertThat(refreshed.getDownloadCount()).isEqualTo(5);

        // Redis key should be consumed
        String remaining = redisTemplate.opsForValue().get("dl-buffer:" + docId);
        assertThat(remaining).isNull();
    }
}
