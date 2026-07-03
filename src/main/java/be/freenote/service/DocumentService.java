package be.freenote.service;

import be.freenote.dto.request.CreateDocumentRequest;
import be.freenote.dto.request.UpdateDocumentRequest;
import be.freenote.dto.response.DocumentResponse;
import be.freenote.dto.response.PageResponse;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface DocumentService {
    DocumentResponse create(CreateDocumentRequest request, MultipartFile file, Long userId);
    /** Create a document from either a PDF (`file`) or 1–8 JPG/PNG images assembled into one PDF (`images`). */
    DocumentResponse create(CreateDocumentRequest request, MultipartFile file, List<MultipartFile> images, Long userId);
    DocumentResponse getById(Long id);
    /** Soft duplicate signal: does a document with this title already exist in the given course? */
    boolean titleExists(String title, Long courseId);
    DocumentResponse adminUpdate(Long documentId, UpdateDocumentRequest request);
    PageResponse<DocumentResponse> search(String query, Long sectionId, Long courseId, String category, String sort, Pageable pageable);
    void delete(Long documentId, Long userId);
    DocumentResponse rename(Long documentId, Long userId, String newTitle);
    void adminDelete(Long documentId);
    List<DocumentResponse> getPopular(Long sectionId);
    PageResponse<DocumentResponse> getUnverified(Pageable pageable);
    /** Groupes de documents au contenu PDF identique (même hash) — vue admin de fusion/suppression. */
    List<List<DocumentResponse>> getDuplicateGroups();
    DocumentResponse verify(Long documentId);
    byte[] download(Long documentId, Long userId);
    PageResponse<DocumentResponse> getByUser(Long userId, Pageable pageable);
}
