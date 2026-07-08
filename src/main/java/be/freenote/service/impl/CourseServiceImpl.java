package be.freenote.service.impl;

import be.freenote.dto.request.CreateCourseRequest;
import be.freenote.dto.response.CourseResponse;
import be.freenote.entity.Course;
import be.freenote.entity.Document;
import be.freenote.entity.Section;
import be.freenote.entity.User;
import be.freenote.exception.DuplicateResourceException;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.mapper.CourseMapper;
import be.freenote.repository.CourseRepository;
import be.freenote.repository.DocumentRepository;
import be.freenote.repository.Repositories;
import be.freenote.repository.SectionRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.CourseService;
import be.freenote.service.MeilisearchService;
import be.freenote.service.MinioService;
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
public class CourseServiceImpl implements CourseService {

    private final CourseRepository courseRepository;
    private final SectionRepository sectionRepository;
    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;
    private final CourseMapper courseMapper;
    private final MinioService minioService;
    private final MeilisearchService meilisearchService;
    private final StatsService statsService;

    @Override
    public List<CourseResponse> getBySectionId(Long sectionId) {
        if (!sectionRepository.existsById(sectionId)) {
            throw new ResourceNotFoundException("Section", "id", sectionId);
        }
        return courseRepository.findApprovedBySectionIdWithDocCount(sectionId).stream()
                .map(row -> courseMapper.toResponse((Course) row[0], (Long) row[1]))
                .toList();
    }

    @Override
    public CourseResponse getById(Long id) {
        Course course = Repositories.findByIdOrThrow(courseRepository, id, "Course");
        return courseMapper.toResponse(course, documentRepository.countByCourseId(id));
    }

    @Override
    @Transactional
    public CourseResponse create(CreateCourseRequest request, Long userId) {
        Section section = Repositories.findByIdOrThrow(sectionRepository, request.getSectionId(), "Section");
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");

        String name = requireName(request.getName());
        if (courseRepository.existsBySectionIdAndNameIgnoreCase(section.getId(), name)) {
            throw new DuplicateResourceException("A course with this name already exists in this section");
        }

        Course course = Course.builder()
                .name(name)
                .section(section)
                .createdBy(user)
                .build();

        return courseMapper.toResponse(courseRepository.save(course), 0);
    }

    @Override
    @Transactional
    public CourseResponse adminCreate(CreateCourseRequest request) {
        Section section = Repositories.findByIdOrThrow(sectionRepository, request.getSectionId(), "Section");
        String name = requireName(request.getName());
        if (courseRepository.existsBySectionIdAndNameIgnoreCase(section.getId(), name)) {
            throw new DuplicateResourceException("A course with this name already exists in this section");
        }
        Course course = Course.builder()
                .name(name)
                .section(section)
                .approved(true)
                .build();
        return courseMapper.toResponse(courseRepository.save(course), 0);
    }

    @Override
    @Transactional
    public CourseResponse approve(Long id) {
        Course course = Repositories.findByIdOrThrow(courseRepository, id, "Course");
        course.setApproved(true);
        return courseMapper.toResponse(courseRepository.save(course), documentRepository.countByCourseId(id));
    }

    @Override
    public List<CourseResponse> getPending() {
        return courseRepository.findByApprovedFalse().stream()
                .map(c -> courseMapper.toResponse(c, 0L))
                .toList();
    }

    @Override
    public List<CourseResponse> getAllForAdmin() {
        return courseRepository.findAllWithDocCount().stream()
                .map(row -> courseMapper.toResponse((Course) row[0], (Long) row[1]))
                .toList();
    }

    @Override
    @Transactional
    public CourseResponse rename(Long id, String name) {
        Course course = Repositories.findByIdOrThrow(courseRepository, id, "Course");
        String sanitized = requireName(name);
        if (!course.getName().equalsIgnoreCase(sanitized)
                && courseRepository.existsBySectionIdAndNameIgnoreCase(course.getSection().getId(), sanitized)) {
            throw new DuplicateResourceException("A course with this name already exists in this section");
        }
        course.setName(sanitized);
        Course saved = courseRepository.save(course);
        return courseMapper.toResponse(saved, documentRepository.countByCourseId(id));
    }

    @Override
    @Transactional
    public void adminDelete(Long id) {
        Course course = Repositories.findByIdOrThrow(courseRepository, id, "Course");
        // Capturer les clés AVANT le delete, nettoyer APRÈS le commit (même pattern que
        // DocumentServiceImpl.cleanupStorageAfterCommit) : un rollback ne doit jamais laisser des
        // lignes vivantes pointant vers des fichiers déjà supprimés.
        List<String> fileKeys = course.getDocuments().stream()
                .map(Document::getFileKey).filter(java.util.Objects::nonNull).toList();
        List<Long> docIds = course.getDocuments().stream().map(Document::getId).toList();
        courseRepository.delete(course);
        cleanupStorageAfterCommit(fileKeys, docIds);
        statsService.invalidateCache();
        log.info("Course deleted by admin: id={}, name={}", id, course.getName());
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

    // --- Équivalences de cours (V15) : « le même cours donné dans plusieurs sections » ---

    @Override
    public List<CourseResponse> getEquivalents(Long courseId) {
        Course course = Repositories.findByIdOrThrow(courseRepository, courseId, "Course");
        if (course.getEquivalenceGroup() == null) {
            return List.of();
        }
        return courseRepository.findByEquivalenceGroupWithSection(course.getEquivalenceGroup()).stream()
                .filter(c -> !c.getId().equals(courseId))
                .map(c -> courseMapper.toResponse(c, 0))
                .toList();
    }

    @Override
    @Transactional
    public List<CourseResponse> setEquivalents(Long courseId, List<Long> otherCourseIds) {
        Course anchor = Repositories.findByIdOrThrow(courseRepository, courseId, "Course");

        java.util.Set<Long> targetIds = new java.util.LinkedHashSet<>(
                otherCourseIds == null ? List.of() : otherCourseIds);
        targetIds.remove(courseId);
        if (targetIds.size() > 20) {
            throw new IllegalArgumentException("Too many equivalent courses (max 20)");
        }
        List<Course> targets = courseRepository.findAllById(targetIds);
        if (targets.size() != targetIds.size()) {
            throw new ResourceNotFoundException("Course", "id", "one of the equivalent course ids");
        }

        // Le dialog admin est LA vérité du groupe de l'ancre : ses anciens membres sont tous
        // détachés d'abord (ceux repris dans la nouvelle liste seront ré-attachés juste après).
        if (anchor.getEquivalenceGroup() != null) {
            courseRepository.findByEquivalenceGroupWithSection(anchor.getEquivalenceGroup())
                    .forEach(c -> c.setEquivalenceGroup(null));
        }
        anchor.setEquivalenceGroup(null);
        if (targets.isEmpty()) {
            log.info("Course equivalence group dissolved: anchor={}", courseId);
            return List.of();
        }

        // Id de groupe FRAIS à chaque réécriture (séquence — jamais un id de cours, cf. V15) ;
        // l'équivalence est transitive : lier A à B alors que B ~ C met A, B et C ensemble.
        Long group = courseRepository.nextEquivalenceGroup();
        java.util.Set<Course> members = new java.util.LinkedHashSet<>(targets);
        members.add(anchor);
        for (Course target : targets) {
            Long g = target.getEquivalenceGroup();
            if (g != null) {
                members.addAll(courseRepository.findByEquivalenceGroupWithSection(g));
            }
        }
        members.forEach(c -> c.setEquivalenceGroup(group));
        log.info("Course equivalence group set: anchor={}, group={}, members={}",
                courseId, group, members.stream().map(Course::getId).toList());
        return getEquivalents(courseId);
    }

    /** Nom stocké brut (trim seul) — React échappe au rendu, comme les titres de documents. */
    private static String requireName(String input) {
        String trimmed = input == null ? "" : input.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("Name is required");
        }
        if (trimmed.length() > 200) {
            throw new IllegalArgumentException("Name too long (max 200)");
        }
        return trimmed;
    }

}
