package be.freenote.service;

import be.freenote.dto.response.NotificationResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.entity.Notification;
import be.freenote.entity.User;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.repository.NotificationRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.impl.NotificationServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Notifications persistées + diffusion SSE. Deux comportements méritent des tests plus que le
 * reste : le <b>plafond de flux par utilisateur</b> (sans lui, un compte peut ouvrir autant
 * d'{@code EventSource} qu'il veut et épuiser les connexions du serveur) et le <b>battement de
 * cœur</b>, qui est la seule chose qui empêche Cloudflare de couper un flux inactif au bout de
 * ~100 s — panne invisible en dev, où il n'y a pas de Cloudflare devant.
 */
@ExtendWith(MockitoExtension.class)
class NotificationServiceImplTest {

    @Mock private NotificationRepository notificationRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks private NotificationServiceImpl service;

    @SuppressWarnings("unchecked")
    private Map<Long, CopyOnWriteArrayList<SseEmitter>> emitters() {
        return (Map<Long, CopyOnWriteArrayList<SseEmitter>>)
                org.springframework.test.util.ReflectionTestUtils.getField(service, "emitters");
    }

    private void givenUserExists(long id) {
        when(userRepository.findById(id)).thenReturn(Optional.of(User.builder().id(id).username("u").build()));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> {
            Notification n = inv.getArgument(0);
            n.setId(1L);
            n.setCreatedAt(LocalDateTime.now());
            return n;
        });
    }

    // --- Écriture ---

    @Test
    void persisteUneNotification() {
        givenUserExists(7L);

        service.push(7L, "document.verified", Map.of("documentId", 3L, "title", "Doc"));

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());
        assertThat(captor.getValue().getType()).isEqualTo("document.verified");
        assertThat(captor.getValue().getPayload()).containsEntry("title", "Doc");
        assertThat(captor.getValue().getUser().getId()).isEqualTo(7L);
    }

    /** Un payload nul devient un objet vide : la colonne JSONB est NOT NULL. */
    @Test
    void remplaceUnPayloadNulParUnObjetVide() {
        givenUserExists(7L);

        service.push(7L, "report.resolved", null);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());
        assertThat(captor.getValue().getPayload()).isEmpty();
    }

    @Test
    void refuseDeNotifierUnCompteInexistant() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.push(99L, "x", Map.of()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // --- Lecture ---

    @Test
    void listeLesNotificationsDUnUtilisateur() {
        Notification n = Notification.builder().id(5L).type("document.verified")
                .payload(Map.of("title", "Doc")).createdAt(LocalDateTime.now()).build();
        when(notificationRepository.findByUserIdOrderByCreatedAtDesc(any(), any()))
                .thenReturn(new PageImpl<>(List.of(n)));

        PageResponse<NotificationResponse> page = service.list(7L, PageRequest.of(0, 10));

        assertThat(page.content()).hasSize(1);
        assertThat(page.content().getFirst().type()).isEqualTo("document.verified");
        // readAt nul ⇒ non lue : c'est ce booléen qui pilote le liseré cyan du panneau.
        assertThat(page.content().getFirst().read()).isFalse();
    }

    @Test
    void marqueUneNotificationLueQuandReadAtEstRenseigne() {
        Notification n = Notification.builder().id(5L).type("x").payload(Map.of())
                .readAt(LocalDateTime.now()).createdAt(LocalDateTime.now()).build();
        when(notificationRepository.findByUserIdOrderByCreatedAtDesc(any(), any()))
                .thenReturn(new PageImpl<>(List.of(n)));

        assertThat(service.list(7L, PageRequest.of(0, 10)).content().getFirst().read()).isTrue();
    }

    @Test
    void compteLesNonLues() {
        when(notificationRepository.countByUserIdAndReadAtIsNull(7L)).thenReturn(4L);
        assertThat(service.unreadCount(7L)).isEqualTo(4);
    }

    @Test
    void marqueToutCommeLu() {
        service.markAllRead(7L);
        verify(notificationRepository).markAllReadForUser(org.mockito.ArgumentMatchers.eq(7L), any());
    }

    // --- Flux SSE ---

    @Test
    void ouvreUnFluxEtLEnregistrePourLUtilisateur() {
        SseEmitter emitter = service.subscribe(7L);

        assertThat(emitter).isNotNull();
        assertThat(emitters().get(7L)).containsExactly(emitter);
    }

    /**
     * Plafond à 5 flux simultanés : quelques onglets ouverts, c'est normal ; un nombre illimité,
     * c'est un déni de service à un seul compte. Le plus ancien est fermé, pas le plus récent —
     * sinon l'onglet que l'utilisateur vient d'ouvrir serait celui qui ne reçoit rien.
     */
    @Test
    void plafonneLesFluxSimultanesEnEvinceantLePlusAncien() {
        SseEmitter first = service.subscribe(7L);
        for (int i = 0; i < 4; i++) {
            service.subscribe(7L);
        }
        assertThat(emitters().get(7L)).hasSize(5).contains(first);

        SseEmitter sixth = service.subscribe(7L);

        assertThat(emitters().get(7L)).hasSize(5).doesNotContain(first).contains(sixth);
    }

    @Test
    void isoleLesFluxDeChaqueUtilisateur() {
        SseEmitter a = service.subscribe(1L);
        SseEmitter b = service.subscribe(2L);

        assertThat(emitters().get(1L)).containsExactly(a);
        assertThat(emitters().get(2L)).containsExactly(b);
    }

    /** Un abonné reçoit l'événement ; les autres comptes ne voient rien passer. */
    @Test
    void diffuseUniquementAuDestinataire() {
        givenUserExists(7L);
        service.subscribe(7L);
        service.subscribe(8L);

        assertThatCode(() -> service.push(7L, "document.verified", Map.of("title", "Doc")))
                .doesNotThrowAnyException();

        assertThat(emitters().get(7L)).hasSize(1);
        assertThat(emitters().get(8L)).hasSize(1);
    }

    @Test
    void pousserSansAucunAbonneNeCassePas() {
        givenUserExists(7L);

        assertThatCode(() -> service.push(7L, "x", Map.of())).doesNotThrowAnyException();
    }

    /** Un flux déjà terminé (onglet fermé) est retiré au lieu de faire échouer le battement. */
    @Test
    void leBattementDeCoeurNettoieLesFluxMorts() {
        SseEmitter emitter = service.subscribe(7L);
        emitter.complete();

        service.heartbeat();

        assertThat(emitters().get(7L)).doesNotContain(emitter);
    }

    @Test
    void leBattementDeCoeurNeCassePasSansAucunFlux() {
        assertThatCode(() -> service.heartbeat()).doesNotThrowAnyException();
    }

    /** Un flux vivant survit au battement — sinon les notifications s'arrêteraient toutes seules. */
    @Test
    void leBattementDeCoeurGardeLesFluxVivants() {
        SseEmitter emitter = service.subscribe(7L);

        service.heartbeat();

        assertThat(emitters().get(7L)).contains(emitter);
    }

    // --- Purge ---

    @Test
    void purgeLesNotificationsDePlusDe90Jours() {
        when(notificationRepository.deleteOlderThan(any())).thenReturn(12);

        service.purgeOldNotifications();

        ArgumentCaptor<LocalDateTime> captor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(notificationRepository).deleteOlderThan(captor.capture());
        assertThat(captor.getValue()).isBefore(LocalDateTime.now().minusDays(89));
    }

    @Test
    void laPurgeSansRienASupprimerNeCassePas() {
        when(notificationRepository.deleteOlderThan(any())).thenReturn(0);

        assertThatCode(() -> service.purgeOldNotifications()).doesNotThrowAnyException();
    }

    /** Le conteneur est concurrent : le battement retire des flux morts en pleine itération. */
    @Test
    void utiliseDesCollectionsConcurrentes() {
        service.subscribe(1L);
        assertThat(emitters()).isInstanceOf(ConcurrentHashMap.class);
        assertThat(emitters().get(1L)).isInstanceOf(CopyOnWriteArrayList.class);
    }
}
