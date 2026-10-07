package be.freenote.service;

import be.freenote.repository.CourseRepository;
import be.freenote.service.impl.CourseEquivalenceServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

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
    void aucunFiltreNeTouchePasLaBase() {
        assertThat(service.resolve(null, null)).isEqualTo(new CourseEquivalenceService.Scope(null, null));
        verifyNoInteractions(courseRepository);
    }
}
