package be.freenote.service;

import be.freenote.dto.response.LinkedCourseRef;
import be.freenote.entity.Course;
import be.freenote.entity.Section;
import be.freenote.repository.CourseRepository;
import be.freenote.service.impl.CourseEquivalenceServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Périmètre des filtres Explorer avec les équivalences de cours.
 *
 * <p>Cas réel qui a motivé {@code resolve} : « Statistiques » lié entre Informatique et Marketing,
 * documents déposés côté Informatique. Choisir le cours en Marketing les montrait, mais la vue
 * « tous les cours » de Marketing annonçait « aucun document » — on concluait qu'il n'y avait rien.</p>
 */
@ExtendWith(MockitoExtension.class)
class CourseEquivalenceServiceImplTest {

    @Mock private CourseRepository courseRepository;
    @InjectMocks private CourseEquivalenceServiceImpl service;

    @Test
    void uneSectionInclutLesCoursLiesASesCours() {
        when(courseRepository.findEquivalenceGroupsBySectionId(2L)).thenReturn(List.of(7L));
        when(courseRepository.findIdsBySectionIdOrEquivalenceGroupIn(2L, List.of(7L)))
                .thenReturn(List.of(20L, 21L, 10L));

        CourseEquivalenceService.Scope scope = service.resolve(2L, null);

        // Le filtre section disparaît : il recouperait la liste et exclurait le cours lié (10L).
        assertThat(scope.sectionId()).isNull();
        assertThat(scope.courseIds()).containsExactly(20L, 21L, 10L);
    }

    @Test
    void uneSectionSansCoursLieGardeSonSimpleFiltre() {
        when(courseRepository.findEquivalenceGroupsBySectionId(2L)).thenReturn(List.of());

        assertThat(service.resolve(2L, null)).isEqualTo(new CourseEquivalenceService.Scope(2L, null));
    }

    @Test
    void unCoursLEmporteSurLaSection() {
        when(courseRepository.findEquivalenceGroupById(20L)).thenReturn(7L);
        when(courseRepository.findIdsByEquivalenceGroup(7L)).thenReturn(List.of(20L, 10L));

        assertThat(service.resolve(2L, 20L))
                .isEqualTo(new CourseEquivalenceService.Scope(null, List.of(20L, 10L)));
    }

    @Test
    void lesCoursLiesExcluentLeCoursLuiMeme() {
        Section info = Section.builder().id(1L).name("Informatique").build();
        Section marketing = Section.builder().id(2L).name("Marketing").build();
        Course statsInfo = Course.builder().id(30L).name("Statistiques").section(info).equivalenceGroup(7L).build();
        Course statsMkt = Course.builder().id(31L).name("Statistiques").section(marketing).equivalenceGroup(7L).build();
        when(courseRepository.findEquivalenceGroupsByIds(List.of(30L, 40L)))
                .thenReturn(List.<Object[]>of(new Object[]{30L, 7L}));
        when(courseRepository.findWithSectionByEquivalenceGroupIn(List.of(7L))).thenReturn(List.of(statsInfo, statsMkt));

        // 40L : cours non lié (absent de la map) ; null : quiz sans cours, ignoré ; 30L en double, dédoublonné.
        Map<Long, List<LinkedCourseRef>> linked = service.linkedCourses(Arrays.asList(30L, 40L, null, 30L));

        assertThat(linked).containsOnlyKeys(30L);
        assertThat(linked.get(30L)).containsExactly(new LinkedCourseRef(31L, "Statistiques", 2L, "Marketing"));
    }

    @Test
    void aucunCoursNeTouchePasLaBase() {
        assertThat(service.linkedCourses(Arrays.asList(null, null))).isEmpty();
        verifyNoInteractions(courseRepository);
    }

    @Test
    void aucunFiltreNeTouchePasLaBase() {
        assertThat(service.resolve(null, null)).isEqualTo(new CourseEquivalenceService.Scope(null, null));
        verifyNoInteractions(courseRepository);
    }
}
