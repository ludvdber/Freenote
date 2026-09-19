package be.freenote.service;

import be.freenote.dto.response.SmtpStatusResponse;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Le garde-fou contre la mort silencieuse de la clé SMTP : Brevo supprime une clé après ~90 jours
 * d'inactivité, et Freenote n'envoie quasiment aucun email de janvier à août. Si ce mécanisme
 * casse, personne ne s'en aperçoit — jusqu'à la rentrée, où le premier étudiant de l'année ne peut
 * plus vérifier son adresse. C'est exactement le genre de code qu'il faut tester puisque son
 * échec est invisible.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SmtpKeepAliveServiceTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private JavaMailSender mailSender;
    @Mock private MimeMessage mimeMessage;

    @InjectMocks private SmtpKeepAliveService service;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        configure("maintenance@freenote.be", 80);
    }

    private void configure(String keepAliveTo, int thresholdDays) {
        ReflectionTestUtils.setField(service, "from", "noreply@freenote.be");
        ReflectionTestUtils.setField(service, "keepAliveTo", keepAliveTo);
        ReflectionTestUtils.setField(service, "thresholdDays", thresholdDays);
    }

    private void lastEmailSentDaysAgo(long days) {
        when(valueOps.get("email:last-sent")).thenReturn(
                String.valueOf(Instant.now().minus(Duration.ofDays(days)).toEpochMilli()));
    }

    private void noEmailEverSent() {
        when(valueOps.get("email:last-sent")).thenReturn(null);
    }

    @Test
    void enregistreLHorodatageApresChaqueEnvoi() {
        service.recordEmailSent();

        verify(valueOps).set(org.mockito.ArgumentMatchers.eq("email:last-sent"), anyString());
    }

    @Test
    void compteLesJoursDInactivite() {
        lastEmailSentDaysAgo(42);
        assertThat(service.daysSinceLastSent()).isEqualTo(42);
    }

    /** -1 = « jamais envoyé », valeur distincte de 0 (« envoyé aujourd'hui »). */
    @Test
    void renvoieMoinsUnQuandAucunEmailNAJamaisEteEnvoye() {
        noEmailEverSent();
        assertThat(service.daysSinceLastSent()).isEqualTo(-1);
    }

    /** Adresse vide = désactivé : dev et local ne doivent JAMAIS envoyer de mail de maintenance. */
    @Test
    void desactiveQuandAucuneAdresseDeMaintenanceNEstConfiguree() {
        configure("", 80);
        assertThat(service.isEnabled()).isFalse();

        service.keepAliveCheck();

        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    void desactiveAussiQuandLAdresseEstNulle() {
        configure(null, 80);
        assertThat(service.isEnabled()).isFalse();
    }

    @Test
    void nEnvoieRienTantQueLeSeuilNEstPasAtteint() {
        lastEmailSentDaysAgo(79);

        service.keepAliveCheck();

        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    void envoieUnMailDeMaintenanceAuSeuil() {
        lastEmailSentDaysAgo(80);

        service.keepAliveCheck();

        verify(mailSender).send(mimeMessage);
        // Le compteur est remis à zéro, sinon le job renverrait un mail chaque jour ensuite.
        verify(valueOps).set(org.mockito.ArgumentMatchers.eq("email:last-sent"), anyString());
    }

    /**
     * « Jamais envoyé » déclenche aussi : c'est voulu — un mail inoffensif amorce le compteur, et
     * sans ça une installation neuve resterait indéfiniment sans horodatage de référence.
     */
    @Test
    void envoieAussiQuandAucunEmailNAJamaisEteEnvoye() {
        noEmailEverSent();

        service.keepAliveCheck();

        verify(mailSender).send(mimeMessage);
    }

    /** Un SMTP injoignable ne doit pas faire remonter d'exception depuis un job planifié. */
    @Test
    void avaleUnEchecDEnvoiSansCasserLeJobPlanifie() {
        lastEmailSentDaysAgo(100);
        doThrow(new MailSendException("SMTP down")).when(mailSender).send(any(MimeMessage.class));

        assertThatCode(() -> service.keepAliveCheck()).doesNotThrowAnyException();
    }

    @Test
    void exposeLeStatutAuPanelAdmin() {
        lastEmailSentDaysAgo(12);

        SmtpStatusResponse status = service.getStatus();

        assertThat(status.daysSinceLastSent()).isEqualTo(12);
        assertThat(status.keepAliveEnabled()).isTrue();
        assertThat(status.thresholdDays()).isEqualTo(80);
        assertThat(status.lastSentEpochMs()).isNotNull();
    }

    @Test
    void statutSansAucunEnvoiEnregistre() {
        noEmailEverSent();

        SmtpStatusResponse status = service.getStatus();

        assertThat(status.lastSentEpochMs()).isNull();
        assertThat(status.daysSinceLastSent()).isEqualTo(-1);
    }
}
