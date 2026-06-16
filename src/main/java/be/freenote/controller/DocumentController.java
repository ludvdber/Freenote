package be.freenote.controller;

import be.freenote.security.SecurityUtils;
import be.freenote.dto.request.CreateDocumentRequest;
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

    private final DocumentService documentService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @RateLimit(max = 5, window = 3600)
    public ResponseEntity<DocumentResponse> create(Authentication authentication,
                                                    @Valid @RequestPart("data") CreateDocumentRequest request,
                                                    @RequestPart("file") MultipartFile file) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(documentService.create(request, file, userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<DocumentResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(documentService.getById(id));
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
                PageRequest.of(page, size)));
    }

    @GetMapping("/popular")
    public ResponseEntity<List<DocumentResponse>> getPopular(
            @RequestParam(required = false) Long sectionId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(2)).cachePublic())
                .body(documentService.getPopular(sectionId));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<PageResponse<DocumentResponse>> getByUser(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "6") int size) {
        return ResponseEntity.ok(documentService.getByUser(userId, PageRequest.of(page, size)));
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
