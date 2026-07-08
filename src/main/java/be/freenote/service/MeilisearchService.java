package be.freenote.service;

import be.freenote.entity.Document;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface MeilisearchService {
    void indexDocument(Document document);

    /** {@code courseIds} : groupe d'équivalence déjà expansé (V15) — null/vide = pas de filtre cours. */
    SearchResult search(String query, Long sectionId, java.util.Collection<Long> courseIds,
                        String category, String sort, Pageable pageable);
    void deleteDocument(Long documentId);

    /** A page of matching document ids (kept in relevance/sort order) plus the total hit count for pagination. */
    record SearchResult(List<Long> ids, long total) {}
}
