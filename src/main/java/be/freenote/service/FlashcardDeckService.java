package be.freenote.service;

import be.freenote.dto.request.PublishDeckRequest;
import be.freenote.dto.response.FlashcardDeckResponse;
import be.freenote.dto.response.FlashcardDeckSummary;
import be.freenote.dto.response.PageResponse;
import org.springframework.data.domain.Pageable;

public interface FlashcardDeckService {

    FlashcardDeckResponse publish(Long userId, PublishDeckRequest request);

    PageResponse<FlashcardDeckSummary> list(Long courseId, Pageable pageable);

    FlashcardDeckResponse get(Long id);

    /** Delete a shared deck — allowed for its owner or an admin (moderation). */
    void delete(Long userId, boolean isAdmin, Long id);
}
