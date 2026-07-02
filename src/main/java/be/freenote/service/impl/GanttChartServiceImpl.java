package be.freenote.service.impl;

import be.freenote.dto.request.GanttTaskDto;
import be.freenote.dto.request.SaveGanttRequest;
import be.freenote.dto.response.GanttResponse;
import be.freenote.dto.response.GanttSummary;
import be.freenote.dto.response.PageResponse;
import be.freenote.entity.GanttChart;
import be.freenote.entity.GanttTaskJson;
import be.freenote.entity.User;
import be.freenote.exception.ForbiddenException;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.mapper.GanttMapper;
import be.freenote.repository.GanttChartRepository;
import be.freenote.repository.Repositories;
import be.freenote.repository.UserRepository;
import be.freenote.service.GanttChartService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GanttChartServiceImpl implements GanttChartService {

    private final GanttChartRepository ganttRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<GanttSummary> listMine(Long userId, Pageable pageable) {
        Page<GanttChart> page = ganttRepository.findByOwnerIdOrderByUpdatedAtDesc(userId, pageable);
        return PageResponse.from(page, page.getContent().stream().map(GanttMapper::toSummary).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<GanttSummary> listShared(Pageable pageable) {
        Page<GanttChart> page = ganttRepository.findSharedForListing(pageable);
        return PageResponse.from(page, page.getContent().stream().map(GanttMapper::toSummary).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public GanttResponse get(Long userId, boolean isAdmin, Long id) {
        GanttChart chart = Repositories.findByIdOrThrow(ganttRepository, id, "GanttChart");
        boolean owned = isOwner(chart, userId);
        if (!chart.isShared() && !owned && !isAdmin) {
            throw new ResourceNotFoundException("GanttChart", "id", id); // hide private charts
        }
        return GanttMapper.toResponse(chart, owned);
    }

    @Override
    @Transactional
    public GanttResponse create(Long userId, SaveGanttRequest request) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        List<GanttTaskJson> tasks = buildTasks(request.tasks());
        GanttChart chart = GanttChart.builder()
                .title(request.title().trim())
                .tasks(tasks)
                .taskCount(tasks.size())
                .shared(request.shared())
                .owner(user)
                .build();
        return GanttMapper.toResponse(ganttRepository.save(chart), true);
    }

    @Override
    @Transactional
    public GanttResponse update(Long userId, boolean isAdmin, Long id, SaveGanttRequest request) {
        GanttChart chart = Repositories.findByIdOrThrow(ganttRepository, id, "GanttChart");
        if (!isOwner(chart, userId) && !isAdmin) {
            throw new ForbiddenException("Vous ne pouvez modifier que vos propres projets.");
        }
        List<GanttTaskJson> tasks = buildTasks(request.tasks());
        chart.setTitle(request.title().trim());
        chart.setTasks(tasks);
        chart.setTaskCount(tasks.size());
        chart.setShared(request.shared());
        return GanttMapper.toResponse(ganttRepository.save(chart), isOwner(chart, userId));
    }

    @Override
    @Transactional
    public void delete(Long userId, boolean isAdmin, Long id) {
        GanttChart chart = Repositories.findByIdOrThrow(ganttRepository, id, "GanttChart");
        if (!isOwner(chart, userId) && !isAdmin) {
            throw new ForbiddenException("Vous ne pouvez supprimer que vos propres projets.");
        }
        ganttRepository.delete(chart);
    }

    private static boolean isOwner(GanttChart chart, Long userId) {
        return chart.getOwner() != null && chart.getOwner().getId().equals(userId);
    }

    /** Validate + normalise tasks: trim, clamp progress to 0–100, drop nameless rows. */
    private static List<GanttTaskJson> buildTasks(List<GanttTaskDto> dtos) {
        List<GanttTaskJson> tasks = new ArrayList<>(dtos.size());
        for (GanttTaskDto d : dtos) {
            if (d.name() == null || d.name().isBlank()) {
                continue;
            }
            int progress = Math.max(0, Math.min(100, d.progress()));
            tasks.add(new GanttTaskJson(
                    blankToNull(d.id()), d.name().trim(),
                    blankToNull(d.start()), blankToNull(d.end()), progress, blankToNull(d.dependencies())));
        }
        if (tasks.isEmpty()) {
            throw new IllegalArgumentException("Le projet ne contient aucune tâche valide.");
        }
        return tasks;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
