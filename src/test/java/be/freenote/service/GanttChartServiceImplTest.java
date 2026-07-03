package be.freenote.service;

import be.freenote.dto.request.GanttTaskDto;
import be.freenote.dto.request.SaveGanttRequest;
import be.freenote.dto.response.GanttResponse;
import be.freenote.entity.GanttChart;
import be.freenote.entity.User;
import be.freenote.exception.ForbiddenException;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.repository.GanttChartRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.impl.GanttChartServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GanttChartServiceImplTest {

    @Mock GanttChartRepository ganttRepository;
    @Mock UserRepository userRepository;
    @InjectMocks GanttChartServiceImpl service;

    private User user(long id) {
        User u = new User();
        u.setId(id);
        u.setUsername("u" + id);
        return u;
    }

    private SaveGanttRequest req(boolean shared) {
        return new SaveGanttRequest("Projet", List.of(
                new GanttTaskDto("t1", "Analyse", "2026-09-01", "2026-09-07", 150, "", "Alice"),
                new GanttTaskDto("t2", "  ", "2026-09-08", "2026-09-20", 0, "t1", null)), shared);
    }

    @Test
    void create_drops_blank_tasks_and_clamps_progress() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user(1)));
        when(ganttRepository.save(any(GanttChart.class))).thenAnswer(i -> i.getArgument(0));

        GanttResponse res = service.create(1L, req(false));

        assertThat(res.tasks()).hasSize(1);                 // the blank-name task is dropped
        assertThat(res.tasks().get(0).progress()).isEqualTo(100); // 150 clamped to 100
        assertThat(res.owned()).isTrue();
    }

    @Test
    void get_hides_a_private_chart_from_a_non_owner() {
        GanttChart chart = GanttChart.builder().id(5L).owner(user(1)).shared(false).tasks(List.of()).build();
        when(ganttRepository.findById(5L)).thenReturn(Optional.of(chart));

        assertThatThrownBy(() -> service.get(2L, false, 5L)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void get_allows_a_shared_chart_for_a_non_owner_but_marks_it_not_owned() {
        GanttChart chart = GanttChart.builder().id(6L).owner(user(1)).shared(true).tasks(List.of()).build();
        when(ganttRepository.findById(6L)).thenReturn(Optional.of(chart));

        GanttResponse res = service.get(2L, false, 6L);

        assertThat(res.shared()).isTrue();
        assertThat(res.owned()).isFalse();
    }

    @Test
    void update_and_delete_refuse_a_non_owner() {
        GanttChart chart = GanttChart.builder().id(7L).owner(user(1)).shared(false).tasks(List.of()).build();
        when(ganttRepository.findById(7L)).thenReturn(Optional.of(chart));

        assertThatThrownBy(() -> service.update(2L, false, 7L, req(true))).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.delete(2L, false, 7L)).isInstanceOf(ForbiddenException.class);
    }
}
