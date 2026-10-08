package be.freenote.integration;

import be.freenote.dto.response.ActivityLogResponse;
import be.freenote.entity.ActivityLog;
import be.freenote.repository.ActivityLogRepository;
import be.freenote.service.ActivityLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Filtres du journal d'activité sur un vrai PostgreSQL : la requête combinée passe des paramètres
 * null (« pas de filtre ») que PostgreSQL doit savoir typer, ce que Spring Data ne vérifie qu'au
 * démarrage sans jamais l'exécuter. Cas d'usage : suivre un étudiant qui ne reçoit pas son code.
 */
@Tag("integration")
class ActivityLogFlowTest extends AbstractIntegrationTest {

    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private ActivityLogService activityLogService;

    @BeforeEach
    void setUp() {
        activityLogRepository.deleteAll();
        activityLogRepository.saveAll(List.of(
                row("EMAIL_CODE_SENT", "Spike", "Code accepté"),
                row("EMAIL_CODE_REJECTED", "Spike", "Code incorrect"),
                row("EMAIL_CODE_SENT", "Luxy", "Code accepté"),
                row("UPLOAD", "Spike", "Synthèse"),
                row("STAFF_ACTION", "Chaimaa", "Rôle Modérateur accordé à Spike")));
    }

    private static ActivityLog row(String type, String actor, String message) {
        return ActivityLog.builder().type(type).actorName(actor).message(message).build();
    }

    private List<String> list(String type, String actor) {
        return activityLogService.list(type, actor, PageRequest.of(0, 50)).content().stream()
                .map(a -> a.type() + "/" + a.actorName())
                .toList();
    }

    @Test
    void familleDeTypesEtPseudoCombines() {
        assertThat(list("EMAIL_*", "spi"))
                .containsExactlyInAnyOrder("EMAIL_CODE_SENT/Spike", "EMAIL_CODE_REJECTED/Spike");
    }

    @Test
    void pseudoSeulInsensibleALaCasse() {
        assertThat(list(null, "SPIKE")).hasSize(4);
    }

    /** Le texte cherche aussi dans le message : un pseudo remonte les actions du staff qui le visent. */
    @Test
    void texteTrouveLesActionsDuStaffQuiVisentLeCompte() {
        assertThat(list("STAFF_ACTION", "spike")).containsExactly("STAFF_ACTION/Chaimaa");
    }

    @Test
    void purgeManuelleEpargneLesActionsDuStaff() {
        activityLogService.purgeBefore(LocalDateTime.now().plusMinutes(1));

        assertThat(activityLogRepository.findAll()).extracting(ActivityLog::getType).containsExactly("STAFF_ACTION");
    }

    @Test
    void typeExactEtPseudo() {
        assertThat(list("EMAIL_CODE_SENT", "luxy")).containsExactly("EMAIL_CODE_SENT/Luxy");
    }

    @Test
    void notableEcarteLeBruit() {
        assertThat(list("NOTABLE", null)).containsExactlyInAnyOrder("UPLOAD/Spike", "STAFF_ACTION/Chaimaa");
    }

    @Test
    void familleSeule() {
        assertThat(list("EMAIL_*", null)).hasSize(3);
    }

    @Test
    void sansFiltre() {
        assertThat(activityLogService.list(null, null, PageRequest.of(0, 50)).content())
                .extracting(ActivityLogResponse::type).hasSize(5);
    }
}
