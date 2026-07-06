package be.freenote.service.impl;

import be.freenote.dto.response.SectionResponse;
import be.freenote.entity.Course;
import be.freenote.entity.Document;
import be.freenote.entity.Section;
import be.freenote.exception.DuplicateResourceException;
import be.freenote.repository.DocumentRepository;
import be.freenote.repository.Repositories;
import be.freenote.repository.SectionRepository;
import be.freenote.service.MeilisearchService;
import be.freenote.service.MinioService;
import be.freenote.service.SectionService;
import be.freenote.service.StatsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@Slf4j
public class SectionServiceImpl implements SectionService {

    private final SectionRepository sectionRepository;
    private final DocumentRepository documentRepository;
    private final MinioService minioService;
    private final MeilisearchService meilisearchService;
    private final StatsService statsService;

    @Override
    public List<SectionResponse> getAll() {
        return sectionRepository.findAllApprovedWithDocCount().stream()
                .map(row -> new SectionResponse(
                        row.getId(),
                        row.getName(),
                        row.getIcon(),
                        row.getDocumentCount() != null ? row.getDocumentCount() : 0,
                        Boolean.TRUE.equals(row.getApproved())
                ))
                .toList();
    }

    @Override
    public List<SectionResponse> getAllForAdmin() {
        return sectionRepository.findAllWithDocCount().stream()
                .map(row -> new SectionResponse(
                        row.getId(),
                        row.getName(),
                        row.getIcon(),
                        row.getDocumentCount() != null ? row.getDocumentCount() : 0,
                        Boolean.TRUE.equals(row.getApproved())
                ))
                .toList();
    }

    @Override
    public SectionResponse getById(Long id) {
        Section section = Repositories.findByIdOrThrow(sectionRepository, id, "Section");
        long docCount = documentRepository.countBySectionId(id);
        return new SectionResponse(section.getId(), section.getName(), section.getIcon(), docCount, section.isApproved());
    }

    @Override
    @Transactional
    public SectionResponse create(String name, String icon) {
        String sanitized = requireName(name);
        if (sectionRepository.existsByNameIgnoreCase(sanitized)) {
            throw new DuplicateResourceException("A section with this name already exists");
        }
        Section section = Section.builder()
                .name(sanitized)
                .icon(normalize(icon))
                .approved(true)
                .build();
        Section saved = sectionRepository.save(section);
        return new SectionResponse(saved.getId(), saved.getName(), saved.getIcon(), 0, saved.isApproved());
    }

    @Override
    @Transactional
    public SectionResponse approve(Long id) {
        Section section = Repositories.findByIdOrThrow(sectionRepository, id, "Section");
        section.setApproved(true);
        Section saved = sectionRepository.save(section);
        long docCount = documentRepository.countBySectionId(id);
        return new SectionResponse(saved.getId(), saved.getName(), saved.getIcon(), docCount, saved.isApproved());
    }

    @Override
    @Transactional
    public SectionResponse rename(Long id, String name, String icon) {
        Section section = Repositories.findByIdOrThrow(sectionRepository, id, "Section");
        String sanitized = requireName(name);
        if (!section.getName().equalsIgnoreCase(sanitized) && sectionRepository.existsByNameIgnoreCase(sanitized)) {
            throw new DuplicateResourceException("A section with this name already exists");
        }
        section.setName(sanitized);
        if (icon != null) {
            section.setIcon(normalize(icon));
        }
        Section saved = sectionRepository.save(section);
        long docCount = documentRepository.countBySectionId(id);
        return new SectionResponse(saved.getId(), saved.getName(), saved.getIcon(), docCount, saved.isApproved());
    }

    @Override
    @Transactional
    public void adminDelete(Long id) {
        Section section = Repositories.findByIdOrThrow(sectionRepository, id, "Section");
        // Capturer les clés AVANT le delete, nettoyer APRÈS le commit (même pattern que
        // DocumentServiceImpl) : un rollback ne doit jamais laisser des lignes vivantes pointant
        // vers des fichiers déjà supprimés.
        List<String> fileKeys = new java.util.ArrayList<>();
        List<Long> docIds = new java.util.ArrayList<>();
        for (Course course : section.getCourses()) {
            for (Document doc : course.getDocuments()) {
                if (doc.getFileKey() != null) {
                    fileKeys.add(doc.getFileKey());
                }
                docIds.add(doc.getId());
            }
        }
        sectionRepository.delete(section);
        cleanupStorageAfterCommit(fileKeys, docIds);
        statsService.invalidateCache();
        log.info("Section deleted by admin: id={}, name={}", id, section.getName());
    }

    private void cleanupStorageAfterCommit(List<String> fileKeys, List<Long> docIds) {
        Runnable cleanup = () -> {
            fileKeys.forEach(minioService::delete);
            docIds.forEach(meilisearchService::deleteDocument);
        };
        if (!org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive()) {
            cleanup.run(); // pas de tx active (tests unitaires Mockito) : nettoyer tout de suite
            return;
        }
        org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                new org.springframework.transaction.support.TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        cleanup.run();
                    }
                });
    }

    /** Nom stocké brut (trim seul) — React échappe au rendu, comme les titres de documents. */
    private static String requireName(String name) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("Name is required");
        }
        if (trimmed.length() > 100) {
            throw new IllegalArgumentException("Name too long (max 100)");
        }
        return trimmed;
    }

    /** Trim + null si vide — remplace l'ancien échappement à l'écriture. */
    private static String normalize(String input) {
        if (input == null) return null;
        String trimmed = input.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

}
