package be.freenote.service;

import be.freenote.dto.request.CreateCourseRequest;
import be.freenote.dto.response.CourseResponse;
import be.freenote.dto.response.CourseStatsResponse;

import java.util.List;

public interface CourseService {
    List<CourseResponse> getBySectionId(Long sectionId);
    CourseResponse getById(Long id);

    /** Stats agrégées du bandeau page cours (équivalences V15 incluses — cohérent avec le listing). */
    CourseStatsResponse getStats(Long courseId);
    CourseResponse create(CreateCourseRequest request, Long userId);
    CourseResponse approve(Long id);
    List<CourseResponse> getPending();
    List<CourseResponse> getAllForAdmin();
    CourseResponse adminCreate(CreateCourseRequest request);
    CourseResponse rename(Long id, String name);
    void adminDelete(Long id);

    /** Cours équivalents (même groupe V15), le cours lui-même exclu — bandeau page cours + dialog admin. */
    List<CourseResponse> getEquivalents(Long courseId);

    /** Redéfinit le groupe d'équivalence du cours : {@code otherCourseIds} devient exactement la
     *  liste de ses équivalents (liste vide = délier). Admin uniquement. */
    List<CourseResponse> setEquivalents(Long courseId, List<Long> otherCourseIds);
}
