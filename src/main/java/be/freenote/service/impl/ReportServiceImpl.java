package be.freenote.service.impl;

import be.freenote.dto.request.ReportRequest;
import be.freenote.dto.request.ResolveReportRequest;
import be.freenote.dto.request.UpdateDocumentRequest;
import be.freenote.dto.response.PageResponse;
import be.freenote.dto.response.ReportResponse;
import be.freenote.entity.Document;
import be.freenote.entity.Report;
import be.freenote.entity.User;
import be.freenote.enums.ReportResolution;
import be.freenote.enums.ReportStatus;
import be.freenote.enums.ReportType;
import be.freenote.exception.ForbiddenException;
import be.freenote.mapper.ReportMapper;
import be.freenote.repository.DocumentRepository;
import be.freenote.repository.Repositories;
import be.freenote.repository.ReportRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.DocumentService;
import be.freenote.service.NotificationService;
import be.freenote.service.ReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReportServiceImpl implements ReportService {

    private final ReportRepository reportRepository;
    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final ReportMapper reportMapper;
    private final DocumentService documentService;
    private final NotificationService notificationService;

    @Override
    @Transactional
    public void create(Long userId, Long documentId, ReportRequest request) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        Document document = Repositories.findByIdOrThrow(documentRepository, documentId, "Document");

        // Signaler son propre document n'a pas de sens : l'auteur peut le corriger ou le supprimer
        // lui-même depuis sa page. Sans ce garde, la file admin se remplit de faux positifs.
        if (document.getUser() != null && document.getUser().getId().equals(userId)) {
            throw new ForbiddenException("Tu peux modifier ou supprimer ton propre document directement.");
        }

        Report report = Report.builder()
                .document(document)
                .user(user)
                .type(ReportType.parse(request.getType()))
                .reason(request.getReason() == null ? "" : request.getReason().trim())
                .build();

        reportRepository.save(report);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ReportResponse> list(ReportStatus status, ReportType type, Pageable pageable) {
        Page<Report> page;
        if (status != null && type != null) {
            page = reportRepository.findByStatusAndType(status, type, pageable);
        } else if (status != null) {
            page = reportRepository.findByStatus(status, pageable);
        } else if (type != null) {
            page = reportRepository.findByType(type, pageable);
        } else {
            page = reportRepository.findAllForModeration(pageable);
        }
        return PageResponse.from(page, page.getContent().stream().map(reportMapper::toResponse).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Long> pendingCountsByType() {
        Map<String, Long> counts = new HashMap<>();
        // Toujours les mêmes clés, même à zéro : le front affiche une rangée de chips stable
        // plutôt qu'une rangée qui change de longueur à chaque signalement traité.
        for (ReportType t : ReportType.values()) {
            counts.put(t.name(), 0L);
        }
        for (Object[] row : reportRepository.countByTypeGrouped(ReportStatus.PENDING)) {
            counts.put(((ReportType) row[0]).name(), (Long) row[1]);
        }
        return counts;
    }

    @Override
    @Transactional
    public void decide(Long reportId, Long adminId, ResolveReportRequest request) {
        Report report = Repositories.findByIdOrThrow(reportRepository, reportId, "Report");
        ReportResolution resolution = parseResolution(request.getResolution());
        String note = trimToNull(request.getNote());
        User admin = adminId == null ? null : userRepository.findById(adminId).orElse(null);

        Document document = report.getDocument();
        Long documentId = document.getId();
        String documentTitle = document.getTitle();
        Long authorId = document.getUser() == null ? null : document.getUser().getId();

        // Un document peut être signalé par plusieurs personnes : la décision vaut pour TOUS les
        // signalements en attente qui le visent, sinon les mêmes faits reviennent en file après coup.
        List<Report> affected = new ArrayList<>(
                reportRepository.findByDocumentIdAndStatus(documentId, ReportStatus.PENDING));
        if (affected.stream().noneMatch(r -> r.getId().equals(reportId))) {
            affected.add(report); // signalement déjà traité qu'on re-tranche : on le couvre aussi
        }

        // Les destinataires sont capturés MAINTENANT : une suppression de document efface les
        // lignes reports en cascade, il serait trop tard pour savoir qui prévenir.
        Set<Long> reporterIds = new LinkedHashSet<>();
        for (Report r : affected) {
            if (r.getUser() != null) {
                reporterIds.add(r.getUser().getId());
            }
        }

        ReportStatus newStatus = resolution == ReportResolution.REJECTED
                ? ReportStatus.DISMISSED
                : ReportStatus.RESOLVED;
        LocalDateTime now = LocalDateTime.now();
        for (Report r : affected) {
            r.setStatus(newStatus);
            r.setResolution(resolution);
            r.setResolutionNote(note);
            r.setResolvedBy(admin);
            r.setResolvedAt(now);
        }
        reportRepository.saveAll(affected);

        // --- L'action réelle sur le document : c'est CE bout qui manquait ---
        switch (resolution) {
            case UNVERIFIED -> {
                if (document.isVerified()) {
                    // Passe par adminUpdate pour hériter de toute sa mécanique : reprise de l'XP
                    // accordé à la vérification, réindexation Meilisearch, invalidation des stats.
                    UpdateDocumentRequest unverify = new UpdateDocumentRequest();
                    unverify.setVerified(false);
                    documentService.adminUpdate(documentId, unverify);
                }
                notifyAuthor(authorId, "document.unverifiedByStaff", documentId, documentTitle, note);
            }
            case DELETED -> {
                notifyAuthor(authorId, "document.deletedByStaff", null, documentTitle, note);
                // En dernier : la cascade documents → reports efface les lignes mises à jour ci-dessus.
                documentService.adminDelete(documentId);
            }
            case NO_ACTION, EDITED, REJECTED -> { /* rien à faire sur le document lui-même */ }
        }

        String notificationType = resolution == ReportResolution.REJECTED
                ? "report.dismissed"
                : "report.resolved";
        for (Long reporterId : reporterIds) {
            Map<String, Object> payload = new HashMap<>();
            payload.put("title", documentTitle);
            payload.put("resolution", resolution.name());
            if (resolution != ReportResolution.DELETED) {
                payload.put("documentId", documentId);
            }
            if (note != null) {
                payload.put("note", note);
            }
            safePush(reporterId, notificationType, payload);
        }

        log.info("Report {} decided: resolution={}, status={}, doc={}, by admin={}",
                reportId, resolution, newStatus, documentId, adminId);
    }

    /** Prévient l'auteur quand SON document est touché : sans ça il découvre la sanction par hasard. */
    private void notifyAuthor(Long authorId, String type, Long documentId, String title, String note) {
        if (authorId == null) {
            return; // document anonymisé (compte supprimé) : plus personne à prévenir
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("title", title);
        if (documentId != null) {
            payload.put("documentId", documentId);
        }
        if (note != null) {
            payload.put("note", note);
        }
        safePush(authorId, type, payload);
    }

    /** Une notification ratée ne doit jamais annuler une décision de modération déjà prise. */
    private void safePush(Long userId, String type, Map<String, Object> payload) {
        try {
            notificationService.push(userId, type, payload);
        } catch (RuntimeException e) {
            log.warn("Notification '{}' non envoyée à l'utilisateur {} : {}", type, userId, e.toString());
        }
    }

    private static ReportResolution parseResolution(String raw) {
        if (raw == null || raw.isBlank()) {
            return ReportResolution.NO_ACTION;
        }
        try {
            return ReportResolution.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Résolution invalide : " + raw);
        }
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
