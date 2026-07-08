package be.freenote.service.impl;

import be.freenote.dto.response.ProfessorResponse;
import be.freenote.entity.Professor;
import be.freenote.mapper.ProfessorMapper;
import be.freenote.repository.DocumentRepository;
import be.freenote.repository.ProfessorRepository;
import be.freenote.repository.Repositories;
import be.freenote.service.ProfessorService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProfessorServiceImpl implements ProfessorService {

    private final ProfessorRepository professorRepository;
    private final DocumentRepository documentRepository;
    private final ProfessorMapper professorMapper;

    @Override
    public List<ProfessorResponse> getAll() {
        return professorRepository.findByApprovedTrueOrderByNameAsc().stream()
                .map(professorMapper::toResponse)
                .toList();
    }

    @Override
    public List<ProfessorResponse> getSuggestedForCourse(Long courseId) {
        List<Long> rankedIds = documentRepository.findProfessorIdsByCourseRankedByUsage(courseId);
        if (rankedIds.isEmpty()) {
            return List.of();
        }
        // findAllById doesn't preserve order, so re-order by the usage ranking via a lookup map.
        Map<Long, Professor> byId = professorRepository.findAllById(rankedIds).stream()
                .collect(Collectors.toMap(Professor::getId, Function.identity()));
        return rankedIds.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .map(professorMapper::toResponse)
                .toList();
    }

    @Override
    public List<ProfessorResponse> getAllForAdmin() {
        return professorRepository.findAllByOrderByNameAsc().stream()
                .map(professorMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional
    public ProfessorResponse create(String name) {
        Professor professor = Professor.builder()
                .name(requireUniqueName(name))
                .build();
        return professorMapper.toResponse(professorRepository.save(professor));
    }

    @Override
    @Transactional
    public ProfessorResponse adminCreate(String name) {
        Professor professor = Professor.builder()
                .name(requireUniqueName(name))
                .approved(true)
                .build();
        return professorMapper.toResponse(professorRepository.save(professor));
    }

    /** Trim + doublon (insensible à la casse) + taille — deux « M. Dupont » pollueraient les
     *  dropdowns d'upload et éclateraient les stats du prof entre les deux entrées. */
    private String requireUniqueName(String name) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("Name is required");
        }
        if (trimmed.length() > 100) {
            throw new IllegalArgumentException("Name too long (max 100)");
        }
        if (professorRepository.existsByNameIgnoreCase(trimmed)) {
            throw new be.freenote.exception.DuplicateResourceException("Ce professeur existe déjà");
        }
        return trimmed;
    }

    @Override
    @Transactional
    public ProfessorResponse approve(Long id) {
        Professor professor = Repositories.findByIdOrThrow(professorRepository, id, "Professor");
        professor.setApproved(true);
        return professorMapper.toResponse(professorRepository.save(professor));
    }

    @Override
    public List<ProfessorResponse> getPending() {
        return professorRepository.findByApprovedFalse().stream()
                .map(professorMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Professor professor = Repositories.findByIdOrThrow(professorRepository, id, "Professor");
        professorRepository.delete(professor);
    }
}
