package be.freenote.integration;

import be.freenote.dto.response.CatalogueGapsResponse;
import be.freenote.dto.response.DocumentResponse;
import be.freenote.dto.response.FlashcardDeckSummary;
import be.freenote.dto.response.LinkedCourseRef;
import be.freenote.dto.response.QuizSummary;
import be.freenote.entity.Course;
import be.freenote.entity.FlashcardDeck;
import be.freenote.entity.Quiz;
import be.freenote.entity.Section;
import be.freenote.entity.User;
import be.freenote.repository.FlashcardDeckRepository;
import be.freenote.repository.QuizAttemptRepository;
import be.freenote.repository.QuizRepository;
import be.freenote.service.DocumentService;
import be.freenote.service.FlashcardDeckService;
import be.freenote.service.PublicDocumentService;
import be.freenote.service.QuizService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.InstanceOfAssertFactories.LIST;

/**
 * Le cas réel « Statistiques » lié entre Informatique et Marketing, documents déposés côté
 * Informatique, rejoué sur un vrai PostgreSQL : les requêtes en jeu (section élargie aux cours
 * liés, anti-jointures de /manques, cours liés des bibliothèques) ne sont que validées au démarrage
 * par Spring Data ; seul ce test les exécute.
 *
 * <p>Avant : la vue « tous les cours » de Marketing annonçait « aucun document » alors que choisir
 * le cours les montrait, /manques listait ce cours comme vide, et le quiz de Statistiques
 * n'apparaissait jamais sous Marketing dans /reviser.</p>
 */
@Tag("integration")
class CourseEquivalenceFlowTest extends AbstractIntegrationTest {

    @Autowired private DocumentService documentService;
    @Autowired private QuizService quizService;
    @Autowired private FlashcardDeckService flashcardDeckService;
    @Autowired private PublicDocumentService publicDocumentService;
    @Autowired private QuizRepository quizRepository;
    @Autowired private QuizAttemptRepository attemptRepository;
    @Autowired private FlashcardDeckRepository deckRepository;

    private Section marketing;
    private Course statsMarketing;
    private User author;

    @BeforeEach
    void setUp() {
        attemptRepository.deleteAll();
        quizRepository.deleteAll();
        deckRepository.deleteAll();
        ratingRepository.deleteAll();
        favoriteRepository.deleteAll();
        donationRepository.deleteAll();
        documentRepository.deleteAll();
        courseRepository.deleteAll();
        sectionRepository.deleteAll();
        userRepository.deleteAll();

        author = createVerifiedUser("stats-author");
        Section info = createSection("Informatique");
        marketing = createSection("Marketing");
        Course statsInfo = createCourse("Statistiques", info, null);
        statsMarketing = createCourse("Statistiques", marketing, null);
        createCourse("Droit commercial", marketing, null);

        Long group = courseRepository.nextEquivalenceGroup();
        statsInfo.setEquivalenceGroup(group);
        statsMarketing.setEquivalenceGroup(group);
        courseRepository.saveAll(List.of(statsInfo, statsMarketing));

        createDocument("Synthese stats", statsInfo, author);
        quizRepository.save(Quiz.builder().title("Quiz stats").owner(author)
                .course(statsInfo).section(info).published(true).build());
        deckRepository.save(FlashcardDeck.builder().title("Paquet stats").owner(author)
                .course(statsInfo).section(info).published(true).build());
        // Contenu « toute la section » : aucun cours, il ne doit pas disparaître du filtre section.
        quizRepository.save(Quiz.builder().title("Quiz marketing general").owner(author)
                .section(marketing).published(true).build());
    }

    @Test
    void uneSectionMontreLesDocumentsDeSesCoursLies() {
        List<DocumentResponse> docs = documentService
                .search(null, marketing.getId(), null, null, null, PageRequest.of(0, 24)).content();

        assertThat(docs).extracting(DocumentResponse::title).containsExactly("Synthese stats");
        assertThat(documentService.getCategoryCounts(marketing.getId(), null)).containsEntry("SYNTHESE", 1L);
    }

    /** Les bibliothèques rangent par section DANS LE NAVIGATEUR : chaque élément doit y porter ses liens. */
    @Test
    void lesQuizEtPaquetsPortentLeursCoursLies() {
        LinkedCourseRef expected = new LinkedCourseRef(
                statsMarketing.getId(), "Statistiques", marketing.getId(), "Marketing");

        List<QuizSummary> quizzes = quizService.list(null, null, null, PageRequest.of(0, 24), null).content();
        assertThat(quizzes).filteredOn(q -> q.title().equals("Quiz stats"))
                .singleElement().extracting(QuizSummary::linkedCourses).asInstanceOf(LIST).containsExactly(expected);
        assertThat(quizzes).filteredOn(q -> q.title().equals("Quiz marketing general"))
                .singleElement().extracting(QuizSummary::linkedCourses).asInstanceOf(LIST).isEmpty();

        List<FlashcardDeckSummary> decks = flashcardDeckService.list(null, null, null, PageRequest.of(0, 24), null).content();
        assertThat(decks).singleElement()
                .extracting(FlashcardDeckSummary::linkedCourses).asInstanceOf(LIST).containsExactly(expected);
    }

    @Test
    void unCoursLieAUnCoursAlimenteNEstPasUnManque() {
        CatalogueGapsResponse gaps = publicDocumentService.getCatalogueGaps();

        List<Long> missing = gaps.sections().stream()
                .flatMap(s -> s.courses().stream())
                .map(CatalogueGapsResponse.CourseGap::id)
                .toList();
        assertThat(missing).doesNotContain(statsMarketing.getId());
        assertThat(gaps.sections().stream().flatMap(s -> s.courses().stream()))
                .extracting(CatalogueGapsResponse.CourseGap::name)
                .containsExactly("Droit commercial");
    }
}
