package be.freenote.service;

import be.freenote.dto.request.CreateDocumentRequest;
import be.freenote.dto.request.UpdateDocumentRequest;
import be.freenote.dto.response.AdjacentDocumentsResponse;
import be.freenote.dto.response.DocumentResponse;
import be.freenote.dto.response.PageResponse;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface DocumentService {
    DocumentResponse create(CreateDocumentRequest request, MultipartFile file, Long userId);
    /** Create a document from either a PDF (`file`) or 1–8 JPG/PNG images assembled into one PDF (`images`). */
    DocumentResponse create(CreateDocumentRequest request, MultipartFile file, List<MultipartFile> images, Long userId);
    /**
     * Détail d'un document. {@code callerId} sert uniquement à renseigner
     * {@link be.freenote.dto.response.DocumentResponse#owned()} — le seul moyen fiable de savoir
     * qu'on est l'auteur d'un document ANONYME, dont {@code authorId} est volontairement nul.
     */
    DocumentResponse getById(Long id, Long callerId);
    /** Soft duplicate signal: does a document with this title already exist in the given course? */
    boolean titleExists(String title, Long courseId);
    DocumentResponse adminUpdate(Long documentId, UpdateDocumentRequest request);
    /**
     * Édition des métadonnées par le PROPRIÉTAIRE du document (titre, cours, catégorie, professeur,
     * année, langue). {@code verified} est ignoré : personne ne se vérifie soi-même.
     */
    DocumentResponse updateOwn(Long documentId, Long userId, UpdateDocumentRequest request);
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
    /** Docs d'un profil : l'auteur ({@code callerId == userId}) voit aussi ses docs en attente,
     *  les autres ne voient que les vérifiés. */
    PageResponse<DocumentResponse> getByUser(Long userId, Long callerId, Pageable pageable);
    /** Voisins chronologiques dans le même cours — navigation précédent/suivant de la page document. */
    AdjacentDocumentsResponse getAdjacent(Long documentId);
    /** Docs par catégorie dans le périmètre section/cours — compteurs des chips de l'explorer. */
    java.util.Map<String, Long> getCategoryCounts(Long sectionId, Long courseId);
    /** Documents créés depuis un instant — chip « N nouveaux depuis ta dernière visite ». */
    long countNewSince(java.time.LocalDateTime since);
}
