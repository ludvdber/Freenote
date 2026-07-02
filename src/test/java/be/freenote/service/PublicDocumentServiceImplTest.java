package be.freenote.service;

import be.freenote.dto.response.PublicDocumentSummary;
import be.freenote.entity.Course;
import be.freenote.entity.Document;
import be.freenote.entity.Section;
import be.freenote.entity.User;
import be.freenote.enums.Category;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.repository.DocumentRepository;
import be.freenote.service.impl.PublicDocumentServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PublicDocumentServiceImplTest {

    @Mock DocumentRepository documentRepository;
    @InjectMocks PublicDocumentServiceImpl service;

    @Test
    void getExcerpt_throws_when_not_a_public_document() {
        when(documentRepository.findPublicExcerptById(eq(99L), any())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getExcerpt(99L)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void getExcerpt_maps_metadata_without_exposing_the_author() {
        Section section = Section.builder().name("Informatique").build();
        Course course = Course.builder().name("Réseaux").section(section).build();
        Document doc = Document.builder()
                .id(5L).title("Mes notes").category(Category.NOTES).year("2026")
                .course(course).user(User.builder().username("secret").build()).verified(true)
                .build();
        when(documentRepository.findPublicExcerptById(eq(5L), any())).thenReturn(Optional.of(doc));

        PublicDocumentSummary res = service.getExcerpt(5L);

        assertThat(res.title()).isEqualTo("Mes notes");
        assertThat(res.courseName()).isEqualTo("Réseaux");
        assertThat(res.sectionName()).isEqualTo("Informatique");
        assertThat(res.category()).isEqualTo("NOTES");
        // The record has no author field at all — anonymisation is structural.
    }
}
