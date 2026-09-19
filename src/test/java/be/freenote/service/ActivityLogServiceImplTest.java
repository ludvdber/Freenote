package be.freenote.service;

import be.freenote.dto.response.ActivityLogResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.entity.ActivityLog;
import be.freenote.enums.ActivityType;
import be.freenote.repository.ActivityLogRepository;
import be.freenote.service.impl.ActivityLogServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Journal d'audit admin. La garantie centrale : <b>écrire une trace ne doit JAMAIS faire échouer
 * l'action qu'elle enregistre</b> — une connexion, un upload ou un bannissement doivent aboutir
 * même si la base d'audit refuse la ligne. D'où le {@code REQUIRES_NEW} et le catch large ; ce
 * test verrouille ce comportement, qui est exactement le genre qu'un refactoring « propre »
 * supprimerait par réflexe.
 */
@ExtendWith(MockitoExtension.class)
class ActivityLogServiceImplTest {

    @Mock private ActivityLogRepository repository;

    @InjectMocks private ActivityLogServiceImpl service;

    private void retention(int days) {
        ReflectionTestUtils.setField(service, "retentionDays", days);
    }

    @Test
    void enregistreUneEntreeAvecSonActeur() {
        service.log(ActivityType.UPLOAD, 7L, "Sophie_M", "Synthèse Java");

        ArgumentCaptor<ActivityLog> captor = ArgumentCaptor.forClass(ActivityLog.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getType()).isEqualTo("UPLOAD");
        assertThat(captor.getValue().getActorId()).isEqualTo(7L);
        assertThat(captor.getValue().getActorName()).isEqualTo("Sophie_M");
        assertThat(captor.getValue().getMessage()).isEqualTo("Synthèse Java");
    }

    /**
     * Cas SIGNUP : le compte tout neuf n'est pas encore committé, la clé étrangère échouerait dans
     * la transaction séparée — seul l'instantané du nom est conservé. L'acteur nul doit passer.
     */
    @Test
    void accepteUnActeurNulEnGardantLInstantaneDuNom() {
        service.log(ActivityType.SIGNUP, null, "nouveau-membre", null);

        ArgumentCaptor<ActivityLog> captor = ArgumentCaptor.forClass(ActivityLog.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getActorId()).isNull();
        assertThat(captor.getValue().getActorName()).isEqualTo("nouveau-membre");
        assertThat(captor.getValue().getMessage()).isNull();
    }

    /** La colonne fait 255 : un message plus long doit être coupé, pas faire exploser l'INSERT. */
    @Test
    void tronqueUnMessageTropLong() {
        service.log(ActivityType.DOC_DELETE, 1L, "admin", "x".repeat(400));

        ArgumentCaptor<ActivityLog> captor = ArgumentCaptor.forClass(ActivityLog.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getMessage()).hasSize(255);
    }

    @Test
    void neTronquePasUnMessageDeTailleLimite() {
        service.log(ActivityType.DOC_VERIFY, 1L, "admin", "x".repeat(255));

        ArgumentCaptor<ActivityLog> captor = ArgumentCaptor.forClass(ActivityLog.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getMessage()).hasSize(255);
    }

    /** LE point important : l'audit ne casse jamais l'action qu'il enregistre. */
    @Test
    void avaleUnEchecDEcritureSansFaireEchouerLActionEnregistree() {
        when(repository.save(any())).thenThrow(new RuntimeException("DB down"));

        assertThatCode(() -> service.log(ActivityType.LOGIN, 1L, "u", "m"))
                .doesNotThrowAnyException();
    }

    @Test
    void listeToutesLesEntreesSansFiltre() {
        ActivityLog a = ActivityLog.builder().id(1L).type("LOGIN").actorId(7L)
                .actorName("Sophie_M").message("m").createdAt(LocalDateTime.now()).build();
        when(repository.findAllByOrderByCreatedAtDesc(any())).thenReturn(new PageImpl<>(List.of(a)));

        PageResponse<ActivityLogResponse> page = service.list(null, PageRequest.of(0, 20));

        assertThat(page.content()).hasSize(1);
        assertThat(page.content().getFirst().type()).isEqualTo("LOGIN");
        verify(repository, never()).findByTypeOrderByCreatedAtDesc(any(), any());
    }

    /** Une chaîne vide vaut « pas de filtre » : le Select de l'UI envoie "" pour « Tous ». */
    @Test
    void traiteUnFiltreVideCommeAbsent() {
        when(repository.findAllByOrderByCreatedAtDesc(any())).thenReturn(new PageImpl<>(List.of()));

        service.list("   ", PageRequest.of(0, 20));

        verify(repository).findAllByOrderByCreatedAtDesc(any());
        verify(repository, never()).findByTypeOrderByCreatedAtDesc(any(), any());
    }

    @Test
    void filtreParTypeQuandIlEstFourni() {
        when(repository.findByTypeOrderByCreatedAtDesc(org.mockito.ArgumentMatchers.eq("UPLOAD"), any()))
                .thenReturn(new PageImpl<>(List.of()));

        service.list("UPLOAD", PageRequest.of(0, 20));

        verify(repository).findByTypeOrderByCreatedAtDesc(org.mockito.ArgumentMatchers.eq("UPLOAD"), any());
        verify(repository, never()).findAllByOrderByCreatedAtDesc(any());
    }

    @Test
    void purgeManuelleRenvoieLeNombreSupprime() {
        LocalDateTime before = LocalDateTime.now().minusDays(30);
        when(repository.deleteByCreatedAtBefore(before)).thenReturn(42);

        assertThat(service.purgeBefore(before)).isEqualTo(42);
    }

    @Test
    void purgeAutomatiqueSurLaRetentionConfiguree() {
        retention(90);
        when(repository.deleteByCreatedAtBefore(any())).thenReturn(3);

        service.autoPrune();

        ArgumentCaptor<LocalDateTime> captor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(repository).deleteByCreatedAtBefore(captor.capture());
        assertThat(captor.getValue()).isBefore(LocalDateTime.now().minusDays(89));
    }

    /** Rétention à 0 ou négative = purge désactivée (conservation illimitée assumée). */
    @Test
    void purgeAutomatiqueDesactivableParLaConfiguration() {
        retention(0);
        service.autoPrune();
        retention(-1);
        service.autoPrune();

        verify(repository, never()).deleteByCreatedAtBefore(any());
    }
}
