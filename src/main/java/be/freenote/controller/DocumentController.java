package be.freenote.controller;

import be.freenote.security.SecurityUtils;
import be.freenote.dto.request.CreateDocumentRequest;
import be.freenote.dto.response.AdjacentDocumentsResponse;
import be.freenote.dto.response.DocumentResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.security.ratelimit.RateLimit;
import be.freenote.service.DocumentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.time.Duration;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
public class DocumentController {

    /** Hard cap on page size — a verified user must not be able to pull the whole table in one call.
     *  100 couvre le plus grand choix du sélecteur « N / page » de l'explorer (96) avec une marge. */
    private static final int MAX_PAGE_SIZE = 100;

    private final DocumentService documentService;

    private static PageRequest pageable(int page, int size) {
        return PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), MAX_PAGE_SIZE));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @RateLimit(max = 3, window = 60, exemptTrusted = true)
    public ResponseEntity<DocumentResponse> create(Authentication authentication,
                                                    @Valid @RequestPart("data") CreateDocumentRequest request,
                                                    @RequestPart(value = "file", required = false) MultipartFile file,
                                                    @RequestPart(value = "images", required = false) List<MultipartFile> images) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(documentService.create(request, file, images, userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<DocumentResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(documentService.getById(id));
    }

    /** Voisins précédent/suivant du même cours (navigation de la page document). */
    @GetMapping("/{id}/adjacent")
    public ResponseEntity<AdjacentDocumentsResponse> getAdjacent(@PathVariable Long id) {
        return ResponseEntity.ok(documentService.getAdjacent(id));
    }

    /** Compteurs par catégorie (chips de l'explorer) dans le périmètre section/cours courant. */
    @GetMapping("/category-counts")
    public ResponseEntity<java.util.Map<String, Long>> getCategoryCounts(
            @RequestParam(required = false) Long sectionId,
            @RequestParam(required = false) Long courseId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(2)))
                .body(documentService.getCategoryCounts(sectionId, courseId));
    }

    /** Nombre de documents créés depuis un instant donné — chip « N nouveaux depuis ta dernière
     *  visite » de l'explorer (l'horodatage de visite vit en localStorage côté client). */
    @GetMapping("/new-count")
    public ResponseEntity<java.util.Map<String, Long>> newCount(@RequestParam String since) {
        final java.time.LocalDateTime ts;
        try {
            ts = java.time.LocalDateTime.parse(since);
        } catch (java.time.format.DateTimeParseException e) {
            throw new IllegalArgumentException("Invalid 'since' timestamp (ISO-8601 expected)");
        }
        return ResponseEntity.ok(java.util.Map.of("count", documentService.countNewSince(ts)));
    }

    /** Soft duplicate signal for the upload form: is there already a same-titled doc in this course?
     *  Never blocks the upload — the frontend just shows a warning. */
    @GetMapping("/title-exists")
    public ResponseEntity<Boolean> titleExists(@RequestParam String title, @RequestParam Long courseId) {
        return ResponseEntity.ok(documentService.titleExists(title, courseId));
    }

    @GetMapping("/{id}/file")
    public ResponseEntity<byte[]> downloadFile(@PathVariable Long id, Authentication authentication) {
        Long userId = authentication != null ? SecurityUtils.currentUserId(authentication) : null;
        byte[] data = documentService.download(id, userId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"document.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                // Private browser cache: re-opens/refreshes of the inline viewer don't re-fetch the
                // whole PDF from MinIO for 10 min. `private` so Cloudflare never caches an authed PDF.
                // Trade-off: repeat opens within the window no longer bump the "Vues" counter.
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(10)).cachePrivate())
                .body(data);
    }

    @GetMapping("/search")
    public ResponseEntity<PageResponse<DocumentResponse>> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long sectionId,
            @RequestParam(required = false) Long courseId,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(documentService.search(q, sectionId, courseId, category, sort,
                pageable(page, size)));
    }

    @GetMapping("/popular")
    public ResponseEntity<List<DocumentResponse>> getPopular(
            @RequestParam(required = false) Long sectionId) {
        return ResponseEntity.ok()
                // private : réponse identique pour tous, mais l'endpoint est authentifié par cookie —
                // un cache partagé (Cloudflare/proxy) ne doit jamais stocker une réponse à cookie.
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(2)).cachePrivate())
                .body(documentService.getPopular(sectionId));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<PageResponse<DocumentResponse>> getByUser(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "6") int size,
            Authentication authentication) {
        Long callerId = authentication != null ? SecurityUtils.currentUserId(authentication) : null;
        return ResponseEntity.ok(documentService.getByUser(userId, callerId, pageable(page, size)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
        Long userId = SecurityUtils.currentUserId(authentication);
        documentService.delete(id, userId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}")
    public ResponseEntity<DocumentResponse> rename(@PathVariable Long id,
                                                   @RequestParam String title,
                                                   Authentication authentication) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.ok(documentService.rename(id, userId, title));
    }
}
