package be.freenote.exception;

import be.freenote.dto.response.ErrorResponse;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.http.HttpMethod;
import org.springframework.mock.http.MockHttpInputMessage;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Le traducteur exceptions → codes HTTP. Deux enjeux réels derrière une classe qui a l'air d'être
 * de la plomberie :
 * <ul>
 *   <li><b>Ne jamais renvoyer 401 pour une erreur métier</b> : l'intercepteur axios du front
 *       traite TOUT 401 comme une expiration de session et déconnecte l'utilisateur. Un code de
 *       vérification mal tapé renvoyé en 401 renvoyait les gens sur l'accueil sans message (bug réel).</li>
 *   <li><b>Ne jamais laisser fuiter le détail interne</b> : contrainte SQL, message Jackson,
 *       trace serveur — un attaquant y lit des noms de colonnes et de classes.</li>
 * </ul>
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    private static void assertStatus(ResponseEntity<ErrorResponse> r, HttpStatus expected) {
        assertThat(r.getStatusCode()).isEqualTo(expected);
        assertThat(r.getBody()).isNotNull();
        assertThat(r.getBody().status()).isEqualTo(expected.value());
        assertThat(r.getBody().timestamp()).isNotNull();
    }

    @Test
    void ressourceIntrouvable() {
        ResponseEntity<ErrorResponse> r = handler.handleNotFound(
                new ResourceNotFoundException("Document", "id", 42L));
        assertStatus(r, HttpStatus.NOT_FOUND);
        assertThat(r.getBody().message()).isEqualTo("Document not found with id: '42'");
    }

    @Test
    void endpointInexistant() {
        var ex = new NoResourceFoundException(HttpMethod.GET, "/api/wp-admin", "/api/wp-admin");
        assertStatus(handler.handleNoResource(ex), HttpStatus.NOT_FOUND);
    }

    @Test
    void argumentInvalide() {
        ResponseEntity<ErrorResponse> r = handler.handleBadRequest(new IllegalArgumentException("Catégorie invalide"));
        assertStatus(r, HttpStatus.BAD_REQUEST);
        assertThat(r.getBody().message()).isEqualTo("Catégorie invalide");
    }

    /** Le détail Jackson (noms de classes internes) ne doit PAS repartir au client. */
    @Test
    void corpsJsonIllisible() {
        ResponseEntity<ErrorResponse> r = handler.handleUnreadableBody(
                new HttpMessageNotReadableException("Cannot deserialize be.freenote.dto.Secret",
                        new MockHttpInputMessage(new byte[0])));
        assertStatus(r, HttpStatus.BAD_REQUEST);
        assertThat(r.getBody().message()).isEqualTo("Corps de requête invalide");
        assertThat(r.getBody().message()).doesNotContain("be.freenote");
    }

    @Test
    void nonAuthentifie() {
        assertStatus(handler.handleUnauthorized(new UnauthorizedException("Not authenticated")), HttpStatus.UNAUTHORIZED);
    }

    @Test
    void interditCouvreLesDeuxOriginesDInterdiction() {
        assertStatus(handler.handleForbidden(new ForbiddenException("Nope")), HttpStatus.FORBIDDEN);
        assertStatus(handler.handleForbidden(new AccessDeniedException("Access denied")), HttpStatus.FORBIDDEN);
    }

    @Test
    void conflitDeDoublon() {
        ResponseEntity<ErrorResponse> r = handler.handleConflict(new DuplicateResourceException("Ce document existe déjà"));
        assertStatus(r, HttpStatus.CONFLICT);
        assertThat(r.getBody().message()).isEqualTo("Ce document existe déjà");
    }

    /** Le message de la base peut nommer une colonne ou une contrainte : il reste au serveur. */
    @Test
    void violationDeContrainteSqlNeFuitePasLeSchema() {
        var ex = new DataIntegrityViolationException(
                "duplicate key value violates unique constraint \"users_email_hash_key\"");
        ResponseEntity<ErrorResponse> r = handler.handleDataIntegrity(ex);

        assertStatus(r, HttpStatus.CONFLICT);
        assertThat(r.getBody().message()).doesNotContain("users_email_hash_key").doesNotContain("constraint");
    }

    @Test
    void fichierTropVolumineux() {
        assertStatus(handler.handlePayloadTooLarge(new PayloadTooLargeException("PDF > 7 Mo")),
                HttpStatus.CONTENT_TOO_LARGE);
        assertStatus(handler.handleMaxUpload(new MaxUploadSizeExceededException(8_000_000L)),
                HttpStatus.CONTENT_TOO_LARGE);
    }

    @Test
    void limiteDeDebitPorteLEnteteRetryAfter() {
        ResponseEntity<ErrorResponse> r = handler.handleRateLimit(
                new RateLimitExceededException("Trop de requêtes", 42));

        assertStatus(r, HttpStatus.TOO_MANY_REQUESTS);
        assertThat(r.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("42");
    }

    /** Sans délai connu, pas d'en-tête bidon : un Retry-After à 0 ferait boucler les clients. */
    @Test
    void limiteDeDebitSansDelaiConnuNAjoutePasLEntete() {
        ResponseEntity<ErrorResponse> r = handler.handleRateLimit(
                new RateLimitExceededException("Trop de requêtes", 0));

        assertStatus(r, HttpStatus.TOO_MANY_REQUESTS);
        assertThat(r.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isNull();
    }

    /** Les scanners tapent des chemins valides avec la mauvaise méthode : 405 propre, pas de 500. */
    @Test
    void mauvaiseMethodeHttp() {
        assertStatus(handler.handleMethodNotSupported(
                new HttpRequestMethodNotSupportedException("GET", List.of("POST"))),
                HttpStatus.METHOD_NOT_ALLOWED);
    }

    @Test
    void stockageIndisponible() {
        assertStatus(handler.handleFileStorage(new FileStorageException("MinIO down")),
                HttpStatus.INTERNAL_SERVER_ERROR);
        assertStatus(handler.handleServiceUnavailable(new ServiceUnavailableException("SMTP down")),
                HttpStatus.SERVICE_UNAVAILABLE);
    }

    /** Onglet fermé en pleine SSE : rien à écrire dans un flux déjà coupé, on avale en silence. */
    @Test
    void deconnexionClientSse() {
        handler.handleClientDisconnect(new AsyncRequestNotUsableException("closed"));
        // Aucun retour : le seul comportement attendu est de ne PAS lever, ni tenter d'écrire.
    }

    @Test
    void erreurInattenduNeFuitePasLaTrace() throws Exception {
        ResponseEntity<ErrorResponse> r = handler.handleGeneric(new NullPointerException("boom at line 42"));

        assertStatus(r, HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(r.getBody().message()).isEqualTo("An unexpected error occurred");
        assertThat(r.getBody().message()).doesNotContain("boom");
    }

    /**
     * Le point le plus fragile : les exceptions Spring Security doivent RE-LEVER pour que la
     * chaîne de filtres produise son 401/403 JSON. Les attraper ici les transformerait en 500.
     */
    @Test
    void lesExceptionsDeSecuriteSontRelanceesVersLaChaineDeFiltres() {
        assertThatThrownBy(() -> handler.handleGeneric(new BadCredentialsException("bad")))
                .isInstanceOf(BadCredentialsException.class);
        assertThatThrownBy(() -> handler.handleGeneric(new AccessDeniedException("denied")))
                .isInstanceOf(AccessDeniedException.class);
    }
}
