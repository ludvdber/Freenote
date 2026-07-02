package be.freenote.service;

import be.freenote.dto.request.SaveGanttRequest;
import be.freenote.dto.response.GanttResponse;
import be.freenote.dto.response.GanttSummary;
import be.freenote.dto.response.PageResponse;
import org.springframework.data.domain.Pageable;

public interface GanttChartService {

    PageResponse<GanttSummary> listMine(Long userId, Pageable pageable);

    PageResponse<GanttSummary> listShared(Pageable pageable);

    /** Accessible if shared, owned by the caller, or the caller is admin — else 404 (existence hidden). */
    GanttResponse get(Long userId, boolean isAdmin, Long id);

    GanttResponse create(Long userId, SaveGanttRequest request);

    GanttResponse update(Long userId, boolean isAdmin, Long id, SaveGanttRequest request);

    void delete(Long userId, boolean isAdmin, Long id);
}
