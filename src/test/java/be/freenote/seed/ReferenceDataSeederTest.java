package be.freenote.seed;

import be.freenote.entity.Course;
import be.freenote.entity.Section;
import be.freenote.repository.CourseRepository;
import be.freenote.repository.SectionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Le catalogue officiel ISFCE (sections + cours) semé au premier démarrage d'un environnement
 * non-dev. C'est du code de PRODUCTION — il tourne sur la vraie base — mais il est exclu du profil
 * {@code test}, donc aucune suite ne l'exécutait : une faute de frappe dans un appel de section ou
 * une régression de l'idempotence ne se serait vue qu'en prod, sur une base déjà peuplée.
 */
@ExtendWith(MockitoExtension.class)
class ReferenceDataSeederTest {

    @Mock private SectionRepository sectionRepository;
    @Mock private CourseRepository courseRepository;

    @InjectMocks private ReferenceDataSeeder seeder;

    /** Base vierge : le semis renvoie les sections telles quelles (pas d'id généré, inutile ici). */
    private void givenEmptyDatabase() {
        when(sectionRepository.count()).thenReturn(0L);
        when(sectionRepository.save(any(Section.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @SuppressWarnings("unchecked")
    private List<Course> capturedCourses() {
        ArgumentCaptor<List<Course>> captor = ArgumentCaptor.forClass(List.class);
        verify(courseRepository, org.mockito.Mockito.atLeastOnce()).saveAll(captor.capture());
        List<Course> all = new ArrayList<>();
        captor.getAllValues().forEach(all::addAll);
        return all;
    }

    private List<Section> capturedSections() {
        ArgumentCaptor<Section> captor = ArgumentCaptor.forClass(Section.class);
        verify(sectionRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
        return captor.getAllValues();
    }

    /**
     * L'idempotence est ce qui protège le catalogue : une fois qu'un admin a renommé ou supprimé
     * des sections, un redémarrage ne doit surtout pas les faire réapparaître.
     */
    @Test
    void neSemeRienSiUneSectionExisteDeja() {
        when(sectionRepository.count()).thenReturn(7L);

        seeder.run();

        verify(sectionRepository, never()).save(any());
        verify(courseRepository, never()).saveAll(any());
    }

    @Test
    void semeLesSectionsIsfceSurUneBaseVierge() {
        givenEmptyDatabase();

        seeder.run();

        List<Section> sections = capturedSections();
        assertThat(sections).hasSizeGreaterThanOrEqualTo(5);
        assertThat(sections).extracting(Section::getName)
                .contains("Assistant de direction")
                .doesNotHaveDuplicates();
        // Tout est pré-approuvé : il n'existe aucun chemin étudiant pour créer une section, donc
        // aucune file d'attente à alimenter (les colonnes `approved` sont vestigiales).
        assertThat(sections).allMatch(Section::isApproved);
        assertThat(sections).allMatch(s -> s.getIcon() != null && !s.getIcon().isBlank());
    }

    @Test
    void rattacheChaqueCoursASaSectionEtLesPreApprouve() {
        givenEmptyDatabase();

        seeder.run();

        List<Course> courses = capturedCourses();
        assertThat(courses).hasSizeGreaterThan(100);
        assertThat(courses).allMatch(Course::isApproved);
        assertThat(courses).allMatch(c -> c.getSection() != null);
        // `createdBy` reste nul : ce sont des cours du référentiel, pas la création d'un utilisateur.
        assertThat(courses).allMatch(c -> c.getCreatedBy() == null);
    }

    @Test
    void aucunNomDeCoursVideOuNonNettoye() {
        givenEmptyDatabase();

        seeder.run();

        assertThat(capturedCourses()).extracting(Course::getName)
                .allMatch(n -> n != null && !n.isBlank() && n.equals(n.trim()));
    }

    /**
     * Un même cours peut légitimement exister dans deux sections (c'est le sujet des équivalences,
     * V15) — mais jamais deux fois dans LA MÊME section : ce serait une ligne dupliquée du
     * référentiel, donc un doublon dans les listes déroulantes de l'upload.
     */
    @Test
    void aucunDoublonDeCoursDansUneMemeSection() {
        givenEmptyDatabase();

        seeder.run();

        assertThat(capturedCourses())
                .extracting(c -> c.getSection().getName() + " | " + c.getName())
                .doesNotHaveDuplicates();
    }
}
