package be.freenote.service;

import be.freenote.dto.response.ActivityLogResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.entity.ActivityLog;
import be.freenote.enums.ActivityType;
import be.freenote.entity.User;
import be.freenote.repository.ActivityLogRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.impl.ActivityLogServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
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
    @Mock private UserRepository userRepository;

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

        PageResponse<ActivityLogResponse> page = service.list(null, null, PageRequest.of(0, 20));

        assertThat(page.content()).hasSize(1);
        assertThat(page.content().getFirst().type()).isEqualTo("LOGIN");
    }

    /** Une chaîne vide vaut « pas de filtre » : le Select de l'UI envoie "" pour « Tous ». */
    @Test
    void traiteUnFiltreVideCommeAbsent() {
        when(repository.findAllByOrderByCreatedAtDesc(any())).thenReturn(new PageImpl<>(List.of()));

        service.list("   ", null, PageRequest.of(0, 20));

        verify(repository).findAllByOrderByCreatedAtDesc(any());
    }

    @Test
    void filtreParTypeQuandIlEstFourni() {
        when(repository.search(eq(false), eq(List.of("UPLOAD")), isNull(), any())).thenReturn(new PageImpl<>(List.of()));

        service.list("UPLOAD", null, PageRequest.of(0, 20));

        verify(repository, never()).findAllByOrderByCreatedAtDesc(any());
    }

    /** Suivre UN étudiant à travers tout le parcours e-mail : famille de types + pseudo. */
    @Test
    void list_familyAndTextUseTheCombinedSearch() {
        List<String> email = List.of("EMAIL_CODE_SENT", "EMAIL_CODE_BLOCKED", "EMAIL_SEND_FAILED",
                "EMAIL_CODE_REJECTED", "EMAIL_VERIFIED");
        when(repository.search(eq(false), eq(email), eq("%spike%"), any())).thenReturn(new PageImpl<>(List.of()));

        service.list("EMAIL_*", " Spike ", PageRequest.of(0, 20));

        verify(repository).search(eq(false), eq(email), eq("%spike%"), any());
    }

    /** « Dernière activité » de la vue d'ensemble : ni connexions, ni étapes e-mail, ni limites. */
    @Test
    @SuppressWarnings("unchecked")
    void list_notableExcludesTheDailyNoise() {
        when(repository.search(eq(false), any(), eq(null), any())).thenReturn(new PageImpl<>(List.of()));

        service.list("NOTABLE", null, PageRequest.of(0, 8));

        ArgumentCaptor<Collection<String>> types = ArgumentCaptor.forClass(Collection.class);
        verify(repository).search(eq(false), types.capture(), eq(null), any());
        assertThat(types.getValue())
                .contains("SIGNUP", "UPLOAD", "DOC_VERIFY", "STAFF_ACTION", "SYSTEM_ALERT")
                .doesNotContain("LOGIN", "RATE_LIMITED", "EMAIL_CODE_SENT", "EMAIL_VERIFIED");
    }

    /** Une purge manuelle ne doit pas pouvoir effacer la trace d'une décision du staff. */
    @Test
    @SuppressWarnings("unchecked")
    void purgeManuelleEpargneLesActionsDuStaff() {
        LocalDateTime before = LocalDateTime.now().minusDays(7);
        when(repository.deleteByTypeInAndCreatedAtBefore(any(), eq(before))).thenReturn(42);

        assertThat(service.purgeBefore(before)).isEqualTo(42);

        ArgumentCaptor<Collection<String>> types = ArgumentCaptor.forClass(Collection.class);
        verify(repository).deleteByTypeInAndCreatedAtBefore(types.capture(), eq(before));
        assertThat(types.getValue()).contains("LOGIN", "EMAIL_CODE_SENT")
                .doesNotContain("STAFF_ACTION", "USER_BAN", "DOC_DELETE", "DOC_VERIFY");
    }

    @Test
    void purgeAutomatiqueParClasseDeConservation() {
        ReflectionTestUtils.setField(service, "shortRetentionDays", 30);
        retention(90);
        ReflectionTestUtils.setField(service, "auditRetentionDays", 365);

        service.autoPrune();

        ArgumentCaptor<LocalDateTime> cutoff = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(repository).deleteByTypeInAndCreatedAtBefore(eq(List.of("LOGIN", "RATE_LIMITED")), cutoff.capture());
        assertThat(cutoff.getValue()).isBefore(LocalDateTime.now().minusDays(29)).isAfter(LocalDateTime.now().minusDays(31));
        verify(repository).deleteByTypeInAndCreatedAtBefore(
                eq(List.of("DOC_DELETE", "DOC_VERIFY", "USER_BAN", "STAFF_ACTION")), cutoff.capture());
        assertThat(cutoff.getValue()).isBefore(LocalDateTime.now().minusDays(364));
    }

    /** Rétention à 0 ou négative = purge de la classe désactivée (conservation illimitée assumée). */
    @Test
    void purgeAutomatiqueDesactivableParLaConfiguration() {
        ReflectionTestUtils.setField(service, "shortRetentionDays", 0);
        retention(-1);
        ReflectionTestUtils.setField(service, "auditRetentionDays", 0);

        service.autoPrune();

        verify(repository, never()).deleteByTypeInAndCreatedAtBefore(any(), any());
    }

    /** L'auteur d'une action du staff est l'utilisateur de la requête, plus un « Admin » anonyme. */
    @Test
    void logStaffResolutLAuteurReel() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(3L, null, List.of()));
        when(userRepository.findById(3L)).thenReturn(Optional.of(User.builder().id(3L).username("Chaimaa").build()));
        try {
            service.logStaff(ActivityType.STAFF_ACTION, "Rôle Modérateur accordé à Spike");
        } finally {
            SecurityContextHolder.clearContext();
        }

        ArgumentCaptor<ActivityLog> captor = ArgumentCaptor.forClass(ActivityLog.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getActorId()).isEqualTo(3L);
        assertThat(captor.getValue().getActorName()).isEqualTo("Chaimaa");
    }
}
