package be.freenote.service.impl;

import be.freenote.dto.request.CreateGuideRequest;
import be.freenote.dto.response.GuideResponse;
import be.freenote.dto.response.GuideSummary;
import be.freenote.dto.response.PageResponse;
import be.freenote.entity.Guide;
import be.freenote.entity.User;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.mapper.GuideMapper;
import be.freenote.mapper.UserMapper;
import be.freenote.repository.GuideRepository;
import be.freenote.repository.Repositories;
import be.freenote.repository.UserRepository;
import be.freenote.service.GuideService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class GuideServiceImpl implements GuideService {

    private final GuideRepository guideRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<GuideSummary> listPublished(Long authorId, Pageable pageable) {
        Page<Guide> page = authorId == null
                ? guideRepository.findByPublishedTrueOrderByCreatedAtDesc(pageable)
                : guideRepository.findByPublishedTrueAndAuthor_IdOrderByCreatedAtDesc(authorId, pageable);
        return PageResponse.from(page, page.getContent().stream().map(GuideMapper::toSummary).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public GuideResponse getPublishedBySlug(String slug, boolean callerVerified) {
        Guide guide = guideRepository.findBySlug(slug)
                .filter(Guide::isPublished)
                .orElseThrow(() -> new ResourceNotFoundException("Guide", "slug", slug));
        // Guide réservé aux étudiants : les métadonnées restent visibles (la page affiche le
        // panneau « réservé » + CTA connexion), le Markdown ne part jamais vers un non-vérifié.
        if (guide.isMembersOnly() && !callerVerified) {
            return GuideMapper.toLockedResponse(guide);
        }
        return GuideMapper.toResponse(guide);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<GuideSummary> listAll(Long callerId, boolean isAdmin, Pageable pageable) {
        // Rédacteur (V18) : son espace de travail = SES guides uniquement (brouillons inclus).
        Page<Guide> page = isAdmin
                ? guideRepository.findAllByOrderByUpdatedAtDesc(pageable)
                : guideRepository.findByAuthor_IdOrderByUpdatedAtDesc(callerId, pageable);
        return PageResponse.from(page, page.getContent().stream().map(GuideMapper::toSummary).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public GuideResponse getById(Long id, Long callerId, boolean isAdmin) {
        Guide guide = Repositories.findByIdOrThrow(guideRepository, id, "Guide");
        requireOwnershipOrAdmin(guide, callerId, isAdmin);
        return GuideMapper.toResponse(guide);
    }

    @Override
    @Transactional
    public GuideResponse create(Long authorId, CreateGuideRequest request) {
        User author = Repositories.findByIdOrThrow(userRepository, authorId, "User");
        Guide guide = Guide.builder()
                .slug(uniqueSlug(slugify(request.title())))
                .title(request.title().trim())
                .summary(blankToNull(request.summary()))
                .content(request.content())
                .category(blankToNull(request.category()))
                .relatedTool(blankToNull(request.relatedTool()))
                .published(request.published())
                .membersOnly(request.membersOnly())
                .author(author)
                .authorName(UserMapper.resolveDisplayName(author.getProfile(), author.getUsername()))
                .build();
        return GuideMapper.toResponse(guideRepository.save(guide));
    }

    @Override
    @Transactional
    public GuideResponse update(Long id, Long callerId, boolean isAdmin, CreateGuideRequest request) {
        Guide guide = Repositories.findByIdOrThrow(guideRepository, id, "Guide");
        requireOwnershipOrAdmin(guide, callerId, isAdmin);
        // Slug is intentionally NOT regenerated — the public URL stays stable across edits.
        guide.setTitle(request.title().trim());
        guide.setSummary(blankToNull(request.summary()));
        guide.setContent(request.content());
        guide.setCategory(blankToNull(request.category()));
        guide.setRelatedTool(blankToNull(request.relatedTool()));
        guide.setPublished(request.published());
        guide.setMembersOnly(request.membersOnly());
        return GuideMapper.toResponse(guideRepository.save(guide));
    }

    @Override
    @Transactional
    public void delete(Long id, Long callerId, boolean isAdmin) {
        Guide guide = Repositories.findByIdOrThrow(guideRepository, id, "Guide");
        requireOwnershipOrAdmin(guide, callerId, isAdmin);
        guideRepository.delete(guide);
    }

    /** Un rédacteur ne touche que SES guides ; un guide orphelin (auteur supprimé) est admin-only. */
    private static void requireOwnershipOrAdmin(Guide guide, Long callerId, boolean isAdmin) {
        if (isAdmin) {
            return;
        }
        if (guide.getAuthor() == null || !guide.getAuthor().getId().equals(callerId)) {
            throw new be.freenote.exception.ForbiddenException("Tu ne peux modifier que tes propres guides.");
        }
    }

    // ── helpers ───────────────────────────────────────────────────

    private String uniqueSlug(String base) {
        String slug = base;
        int i = 2;
        while (guideRepository.existsBySlug(slug)) {
            slug = base + "-" + i++;
        }
        return slug;
    }

    /** Accent-stripped, lowercased, hyphen-joined slug bounded to 140 chars (leaves room for a suffix). */
    private static String slugify(String input) {
        String n = Normalizer.normalize(input, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        n = n.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+|-+$)", "");
        if (n.isBlank()) {
            return "guide";
        }
        return n.length() > 140 ? n.substring(0, 140).replaceAll("-+$", "") : n;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
