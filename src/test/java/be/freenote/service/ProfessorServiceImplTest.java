package be.freenote.service;

import be.freenote.dto.response.ProfessorResponse;
import be.freenote.entity.Professor;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.mapper.ProfessorMapper;
import be.freenote.repository.ProfessorRepository;
import be.freenote.service.impl.ProfessorServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProfessorServiceImplTest {

    @Mock private ProfessorRepository professorRepository;
    @Mock private ProfessorMapper professorMapper;

    @InjectMocks private ProfessorServiceImpl professorService;

    @Test
    void shouldCreateProfessor() {
        Professor prof = Professor.builder().id(1L).name("Dupont").approved(false).build();

        when(professorRepository.save(any(Professor.class))).thenReturn(prof);
        when(professorMapper.toResponse(prof)).thenReturn(new ProfessorResponse(1L, "Dupont"));

        ProfessorResponse result = professorService.create("Dupont");

        assertThat(result.name()).isEqualTo("Dupont");
    }

    @Test
    void shouldApproveProfessor() {
        Professor prof = Professor.builder().id(1L).name("Dupont").approved(false).build();

        when(professorRepository.findById(1L)).thenReturn(Optional.of(prof));
        when(professorRepository.save(prof)).thenReturn(prof);
        when(professorMapper.toResponse(prof)).thenReturn(new ProfessorResponse(1L, "Dupont"));

        professorService.approve(1L);

        assertThat(prof.isApproved()).isTrue();
    }

    @Test
    void shouldReturnOnlyApprovedProfessors() {
        Professor approved = Professor.builder().id(1L).name("A").approved(true).build();

        when(professorRepository.findByApprovedTrueOrderByNameAsc()).thenReturn(List.of(approved));
        when(professorMapper.toResponse(approved)).thenReturn(new ProfessorResponse(1L, "A"));

        List<ProfessorResponse> result = professorService.getAll();

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().name()).isEqualTo("A");
    }

    @Test
    void shouldThrowNotFoundWhenApprovingNonExistentProfessor() {
        when(professorRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> professorService.approve(999L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void shouldReturnPendingProfessors() {
        Professor pending = Professor.builder().id(2L).name("B").approved(false).build();

        when(professorRepository.findByApprovedFalse()).thenReturn(List.of(pending));
        when(professorMapper.toResponse(pending)).thenReturn(new ProfessorResponse(2L, "B"));

        List<ProfessorResponse> result = professorService.getPending();

        assertThat(result).hasSize(1);
    }
}
