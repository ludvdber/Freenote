package be.freenote.mapper;

import be.freenote.dto.response.CourseResponse;
import be.freenote.entity.Course;
import org.mapstruct.*;

@Mapper(componentModel = "spring")
public interface CourseMapper {

    @Mapping(target = "sectionId", source = "course.section.id")
    @Mapping(target = "sectionName", source = "course.section.name")
    @Mapping(target = "documentCount", source = "docCount")
    @Mapping(target = "approved", source = "course.approved")
    @Mapping(target = "equivalenceGroup", source = "course.equivalenceGroup")
    CourseResponse toResponse(Course course, long docCount);
}
