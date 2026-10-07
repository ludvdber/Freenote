package be.freenote.service.impl;

import be.freenote.dto.response.LinkedCourseRef;
import be.freenote.entity.Course;
import be.freenote.repository.CourseRepository;
import be.freenote.service.CourseEquivalenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CourseEquivalenceServiceImpl implements CourseEquivalenceService {

    private final CourseRepository courseRepository;

    @Override
    public List<Long> expand(Long courseId) {
        if (courseId == null) {
            return null;
        }
        Long group = courseRepository.findEquivalenceGroupById(courseId);
        if (group == null) {
            // Cours inexistant ou non lié : filtre inchangé (un id inconnu matche zéro doc, comme avant)
            return List.of(courseId);
        }
        return courseRepository.findIdsByEquivalenceGroup(group);
    }

    @Override
    public Scope resolve(Long sectionId, Long courseId) {
        if (courseId != null) {
            return new Scope(null, expand(courseId));
        }
        if (sectionId == null) {
            return new Scope(null, null);
        }
        List<Long> groups = courseRepository.findEquivalenceGroupsBySectionId(sectionId);
        if (groups.isEmpty()) {
            // Aucun cours lié : le filtre section suffit (et reste une simple jointure, sans IN).
            return new Scope(sectionId, null);
        }
        // La liste couvre déjà toute la section : le filtre section deviendrait une intersection
        // qui excluerait justement les cours liés des autres sections.
        return new Scope(null, courseRepository.findIdsBySectionIdOrEquivalenceGroupIn(sectionId, groups));
    }

    @Override
    public Map<Long, List<LinkedCourseRef>> linkedCourses(Collection<Long> courseIds) {
        List<Long> ids = courseIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, Long> groupOf = new HashMap<>();
        for (Object[] row : courseRepository.findEquivalenceGroupsByIds(ids)) {
            groupOf.put((Long) row[0], (Long) row[1]);
        }
        if (groupOf.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<Course>> members = courseRepository
                .findWithSectionByEquivalenceGroupIn(groupOf.values().stream().distinct().toList()).stream()
                .collect(Collectors.groupingBy(Course::getEquivalenceGroup));
        Map<Long, List<LinkedCourseRef>> result = new HashMap<>();
        groupOf.forEach((courseId, group) -> result.put(courseId, members.getOrDefault(group, List.of()).stream()
                .filter(c -> !c.getId().equals(courseId))
                .map(c -> new LinkedCourseRef(c.getId(), c.getName(), c.getSection().getId(), c.getSection().getName()))
                .toList()));
        return result;
    }
}
