package be.freenote.service.impl;

import be.freenote.repository.CourseRepository;
import be.freenote.service.CourseEquivalenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

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
}
