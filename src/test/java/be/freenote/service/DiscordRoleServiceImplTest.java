package be.freenote.service;

import be.freenote.service.impl.DiscordRoleServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Attribution des rôles Discord (« vérifié » après validation de l'email, « Supporter » après un
 * don). Le contrat tient en une phrase : <b>rien de ce qui se passe côté Discord ne doit jamais
 * remonter dans le flux appelant</b> — une panne, un 401 sur un token périmé ou un bot mal
 * configuré ne peuvent pas faire échouer une vérification d'email ou l'encaissement d'un don.
 * Et une configuration vide vaut « désactivé », pour que dev et local ne parlent jamais à Discord.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DiscordRoleServiceImplTest {

    @Mock private HttpClient httpClient;
    @SuppressWarnings("unchecked")
    private final HttpResponse<String> response = org.mockito.Mockito.mock(HttpResponse.class);

    /** Le client HTTP est construit dans le service : on le remplace par un mock. */
    private DiscordRoleServiceImpl service(String token, String guild, String verifiedRole, String supporterRole) {
        DiscordRoleServiceImpl s = new DiscordRoleServiceImpl(token, guild, verifiedRole, supporterRole);
        ReflectionTestUtils.setField(s, "httpClient", httpClient);
        return s;
    }

    private DiscordRoleServiceImpl configured() {
        return service("bot-token", "guild-1", "role-verified", "role-supporter");
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private void respondWith(int status) throws Exception {
        when(response.statusCode()).thenReturn(status);
        when(response.body()).thenReturn("{}");
        when(httpClient.send(any(HttpRequest.class), any())).thenReturn((HttpResponse) response);
    }

    // --- Désactivation par configuration ---

    @Test
    void neParlePasADiscordSansJetonDeBot() throws Exception {
        service("", "guild-1", "role-verified", "role-supporter").assignVerifiedRole("123");

        verify(httpClient, never()).send(any(), any());
    }

    @Test
    void neParlePasADiscordSansIdentifiantDeServeur() throws Exception {
        service("bot-token", "", "role-verified", "role-supporter").assignVerifiedRole("123");

        verify(httpClient, never()).send(any(), any());
    }

    /**
     * Chaque rôle s'active indépendamment par son propre id : un serveur peut vouloir le rôle
     * « vérifié » sans avoir créé de rôle « Supporter ».
     */
    @Test
    void chaqueRoleSActiveIndependamment() throws Exception {
        respondWith(204);
        DiscordRoleServiceImpl s = service("bot-token", "guild-1", "role-verified", "");

        s.assignSupporterRole("123");
        verify(httpClient, never()).send(any(), any());

        s.assignVerifiedRole("123");
        verify(httpClient).send(any(), any());
    }

    @Test
    void ignoreUnIdentifiantDiscordAbsent() throws Exception {
        configured().assignVerifiedRole(null);
        configured().assignVerifiedRole("   ");

        verify(httpClient, never()).send(any(), any());
    }

    // --- Réponses de l'API ---

    @Test
    void accordeLeRoleSurUneReponseDeSucces() throws Exception {
        respondWith(204);

        configured().assignVerifiedRole("123");

        verify(httpClient).send(any(HttpRequest.class), any());
    }

    /**
     * 404 = l'utilisateur a vérifié son email AVANT de rejoindre le serveur. C'est le trou connu
     * (rattrapage prévu par un bot passerelle) : il doit rester silencieux, pas exploser.
     */
    @Test
    void toleUnUtilisateurPasEncoreSurLeServeur() throws Exception {
        respondWith(404);

        assertThatCode(() -> configured().assignVerifiedRole("123")).doesNotThrowAnyException();
    }

    @Test
    void toleUnBotMalConfigureOuUnJetonInvalide() throws Exception {
        respondWith(403); // permission « Gérer les rôles » manquante, ou rôle du bot trop bas
        assertThatCode(() -> configured().assignVerifiedRole("123")).doesNotThrowAnyException();

        respondWith(401); // jeton de bot invalide
        assertThatCode(() -> configured().assignVerifiedRole("123")).doesNotThrowAnyException();
    }

    @Test
    void toleUneLimitationDeDebitEtToutStatutInattendu() throws Exception {
        respondWith(429);
        assertThatCode(() -> configured().assignSupporterRole("123")).doesNotThrowAnyException();

        respondWith(500);
        assertThatCode(() -> configured().assignSupporterRole("123")).doesNotThrowAnyException();
    }

    /** Discord injoignable : l'appelant (vérification d'email, webhook Ko-fi) ne doit rien voir. */
    @Test
    void avaleUnePanneReseau() throws Exception {
        when(httpClient.send(any(HttpRequest.class), any())).thenThrow(new IOException("connection reset"));

        assertThatCode(() -> configured().assignVerifiedRole("123")).doesNotThrowAnyException();
    }
}
