package be.freenote.repository;

import be.freenote.entity.Guide;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GuideRepository extends JpaRepository<Guide, Long> {

    Optional<Guide> findBySlug(String slug);

    boolean existsBySlug(String slug);

    /** Public listing: only published guides, newest first. */
    Page<Guide> findByPublishedTrueOrderByCreatedAtDesc(Pageable pageable);

    /** Admin listing: everything (drafts included), most-recently edited first. */
    Page<Guide> findAllByOrderByUpdatedAtDesc(Pageable pageable);
}
