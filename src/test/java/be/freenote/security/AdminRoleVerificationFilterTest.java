package be.freenote.security;

import be.freenote.entity.User;
import be.freenote.repository.UserRepository;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Le garde-fou du panel : sur CHAQUE /api/admin/**, il relit le statut staff en base plutôt que de
 * croire le JWT (valable 24 h). C'est ce qui rend une promotion et surtout une <b>rétrogradation</b>
 * immédiates. Il n'était pas testé du tout — alors qu'une régression ici laisserait un ex-admin
 * garder son accès une journée entière, ou empêcherait un modérateur fraîchement nommé d'entrer.
 */
@ExtendWith(MockitoExtension.class)
class AdminRoleVerificationFilterTest {

    @Mock private UserRepository userRepository;
    @Mock private FilterChain filterChain;

    @InjectMocks private AdminRoleVerificationFilter filter;

    private final MockHttpServletResponse response = new MockHttpServletResponse();

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private static MockHttpServletRequest adminRequest() {
        return new MockHttpServletRequest("GET", "/api/admin/documents/pending");
    }

    /** Le principal est l'id Long posé par JwtAuthFilter — jamais un username. */
    private static void authenticateAs(Long userId, String... roles) {
        var authorities = java.util.Arrays.stream(roles).map(SimpleGrantedAuthority::new).toList();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId, null, authorities));
    }

    private static User staff(long id, String role, boolean moderator, boolean editor) {
        return User.builder().id(id).username("u" + id).role(role)
                .moderator(moderator).editor(editor).build();
    }

    private static List<String> currentAuthorities() {
        return SecurityContextHolder.getContext().getAuthentication().getAuthorities()
                .stream().map(a -> a.getAuthority()).sorted().toList();
    }

    // --- Périmètre ---

    @Test
    void reconnaitLesRoutesAdmin() {
        assertThat(AdminRoleVerificationFilter.isAdminPath(new MockHttpServletRequest("GET", "/api/documents/1"))).isFalse();
        assertThat(AdminRoleVerificationFilter.isAdminPath(new MockHttpServletRequest("GET", "/api/admin/users"))).isTrue();
    }

    /** « /api/administration » n'est pas une route du panel. */
    @Test
    void neConfondPasUnCheminQuiCommenceParAdminSansSlash() {
        assertThat(AdminRoleVerificationFilter.isAdminPath(new MockHttpServletRequest("GET", "/api/administration"))).isFalse();
    }

    /**
     * Spring décode le chemin avant de router : « /api/%61dmin/… » atteint le panel. Le filtre
     * comparait l'adresse BRUTE et laissait passer un admin rétrogradé (vu en test d'intégration).
     */
    @Test
    void reconnaitUneRouteAdminEncodee() {
        MockHttpServletRequest encoded = new MockHttpServletRequest("GET", "/api/%61dmin/analytics");
        assertThat(AdminRoleVerificationFilter.isAdminPath(encoded)).isTrue();
    }

    /** Hors du panel, un jeton sans ROLE_ADMIN ne coûte aucune requête en base. */
    @Test
    void neConsultePasLaBaseHorsDuPanelPourUnNonAdmin() throws Exception {
        authenticateAs(5L, "ROLE_USER", "ROLE_VERIFIED");

        filter.doFilter(new MockHttpServletRequest("GET", "/api/quizzes/3"), response, filterChain);

        verify(userRepository, never()).findById(anyLong());
        verify(filterChain).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    /**
     * Hors du panel, le ROLE_ADMIN d'un jeton périmé ouvrait encore les contenus des autres, actuator
     * et l'exemption de limites de débit : il est retiré, sans bloquer la requête elle-même.
     */
    @Test
    void retireLeRoleAdminDUnJetonPerimeHorsDuPanel() throws Exception {
        authenticateAs(5L, "ROLE_USER", "ROLE_VERIFIED", "ROLE_ADMIN");
        when(userRepository.findById(5L)).thenReturn(Optional.of(staff(5L, "VERIFIED", false, false)));

        filter.doFilter(new MockHttpServletRequest("DELETE", "/api/quizzes/3"), response, filterChain);

        assertThat(currentAuthorities()).containsExactly("ROLE_USER", "ROLE_VERIFIED");
        verify(filterChain).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    /**
     * Admin rétrogradé mais resté modérateur : il passe le filtre (il est staff), et son ancien
     * ROLE_ADMIN restait en place — tout le panel, jusqu'à se repromouvoir lui-même.
     */
    @Test
    void unAdminRetrogradeResteModerateurPerdSonRoleAdmin() throws Exception {
        authenticateAs(5L, "ROLE_USER", "ROLE_VERIFIED", "ROLE_ADMIN");
        when(userRepository.findById(5L)).thenReturn(Optional.of(staff(5L, "VERIFIED", true, false)));

        filter.doFilter(adminRequest(), response, filterChain);

        assertThat(currentAuthorities()).containsExactly("ROLE_MODERATOR", "ROLE_USER", "ROLE_VERIFIED");
    }

    // --- Refus ---

    @Test
    void refuseUnSimpleUtilisateurSansAppelerLeControleur() throws Exception {
        authenticateAs(5L, "ROLE_USER", "ROLE_VERIFIED");
        when(userRepository.findById(5L)).thenReturn(Optional.of(staff(5L, "USER", false, false)));

        filter.doFilter(adminRequest(), response, filterChain);

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentAsString()).contains("Access denied");
        assertThat(response.getContentType()).isEqualTo("application/json");
        verify(filterChain, never()).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        // Le contexte est vidé : la requête ne peut plus rien atteindre en aval.
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    /**
     * LE cas qui justifie ce filtre : un JWT qui porte encore ROLE_ADMIN alors que la base dit que
     * le compte a été rétrogradé. Sans relecture en base, l'accès survivrait jusqu'à l'expiration.
     */
    @Test
    void refuseUnAdminRetrogradeMemeSiSonJetonDitEncoreAdmin() throws Exception {
        authenticateAs(5L, "ROLE_USER", "ROLE_ADMIN");
        when(userRepository.findById(5L)).thenReturn(Optional.of(staff(5L, "USER", false, false)));

        filter.doFilter(adminRequest(), response, filterChain);

        assertThat(response.getStatus()).isEqualTo(403);
        verify(filterChain, never()).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    /** Compte supprimé entre l'émission du jeton et la requête. */
    @Test
    void refuseUnCompteQuiNExistePlus() throws Exception {
        authenticateAs(5L, "ROLE_ADMIN");
        when(userRepository.findById(5L)).thenReturn(Optional.empty());

        filter.doFilter(adminRequest(), response, filterChain);

        assertThat(response.getStatus()).isEqualTo(403);
    }

    /** Anonyme : le filtre laisse passer, la chaîne de sécurité produira son 401 plus loin. */
    @Test
    void laissePasserSansAuthentificationPourQueLaChaineRepondeElleMeme() throws Exception {
        filter.doFilter(adminRequest(), response, filterChain);

        verify(filterChain).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        verify(userRepository, never()).findById(anyLong());
        assertThat(response.getStatus()).isEqualTo(200);
    }

    /** Principal qui n'est pas un id (chaîne « anonymousUser ») : ne pas tenter de le caster. */
    @Test
    void laissePasserUnPrincipalQuiNEstPasUnIdentifiant() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("anonymousUser", null, List.of()));

        filter.doFilter(adminRequest(), response, filterChain);

        verify(filterChain).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        verify(userRepository, never()).findById(anyLong());
    }

    // --- Octroi ---

    @Test
    void laissePasserUnAdmin() throws Exception {
        authenticateAs(1L, "ROLE_USER", "ROLE_ADMIN");
        when(userRepository.findById(1L)).thenReturn(Optional.of(staff(1L, "ADMIN", false, false)));

        filter.doFilter(adminRequest(), response, filterChain);

        verify(filterChain).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        assertThat(currentAuthorities()).contains("ROLE_ADMIN");
    }

    /**
     * Les rôles staff V18 ne sont JAMAIS dans le JWT : c'est ce filtre qui les accorde depuis la
     * base, sinon les matchers hasAnyRole("ADMIN","MODERATOR") ne verraient jamais un modérateur.
     */
    @Test
    void accordeModerateurAbsentDuJeton() throws Exception {
        authenticateAs(2L, "ROLE_USER", "ROLE_VERIFIED");
        when(userRepository.findById(2L)).thenReturn(Optional.of(staff(2L, "USER", true, false)));

        filter.doFilter(adminRequest(), response, filterChain);

        assertThat(currentAuthorities()).contains("ROLE_MODERATOR").doesNotContain("ROLE_ADMIN");
        verify(filterChain).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void accordeRedacteurAbsentDuJeton() throws Exception {
        authenticateAs(3L, "ROLE_USER");
        when(userRepository.findById(3L)).thenReturn(Optional.of(staff(3L, "USER", false, true)));

        filter.doFilter(adminRequest(), response, filterChain);

        assertThat(currentAuthorities()).contains("ROLE_EDITOR").doesNotContain("ROLE_MODERATOR");
    }

    /** Les deux flags sont cumulables et orthogonaux à USER/VERIFIED/ADMIN. */
    @Test
    void accordeLesDeuxRolesCumulesEtPreserveLesAutorisationsExistantes() throws Exception {
        authenticateAs(4L, "ROLE_USER", "ROLE_VERIFIED");
        when(userRepository.findById(4L)).thenReturn(Optional.of(staff(4L, "USER", true, true)));

        filter.doFilter(adminRequest(), response, filterChain);

        assertThat(currentAuthorities())
                .containsExactly("ROLE_EDITOR", "ROLE_MODERATOR", "ROLE_USER", "ROLE_VERIFIED");
    }

    /** Promotion ADMIN faite après l'émission du jeton : effective sans re-login. */
    @Test
    void accordeAdminPromuApresLEmissionDuJeton() throws Exception {
        authenticateAs(6L, "ROLE_USER", "ROLE_VERIFIED");
        when(userRepository.findById(6L)).thenReturn(Optional.of(staff(6L, "ADMIN", false, false)));

        filter.doFilter(adminRequest(), response, filterChain);

        assertThat(currentAuthorities()).contains("ROLE_ADMIN");
    }

    /** Rien à ajouter : on ne remplace pas l'authentification pour le plaisir. */
    @Test
    void neRemplacePasLAuthentificationQuandRienNeChange() throws Exception {
        authenticateAs(1L, "ROLE_ADMIN");
        var before = SecurityContextHolder.getContext().getAuthentication();
        when(userRepository.findById(1L)).thenReturn(Optional.of(staff(1L, "ADMIN", false, false)));

        filter.doFilter(adminRequest(), response, filterChain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isSameAs(before);
    }
}
