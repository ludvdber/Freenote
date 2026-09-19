package be.freenote.mapper;

import be.freenote.dto.response.ReportResponse;
import be.freenote.entity.Report;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ReportMapper {

    @Mapping(target = "documentId", source = "document.id")
    @Mapping(target = "documentTitle", source = "document.title")
    @Mapping(target = "documentCourseName", source = "document.course.name")
    @Mapping(target = "documentCategory", source = "document.category")
    @Mapping(target = "documentVerified", source = "document.verified")
    // Vue MODÉRATION : l'anonymat protège l'auteur des autres étudiants, pas de l'admin qui doit
    // pouvoir le contacter. Le username technique (pas le displayName) — c'est lui qui sert à agir
    // sur le compte dans AdminUsers.
    @Mapping(target = "documentAuthorName", source = "document.user.username")
    @Mapping(target = "documentAuthorId", source = "document.user.id")
    @Mapping(target = "reporterUsername", source = "user.username")
    @Mapping(target = "reporterId", source = "user.id")
    @Mapping(target = "resolvedByName", source = "resolvedBy.username")
    @Mapping(target = "createdAt", source = "createdAt")
    ReportResponse toResponse(Report report);
}
