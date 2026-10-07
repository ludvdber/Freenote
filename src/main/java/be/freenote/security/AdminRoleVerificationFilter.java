package be.freenote.security;

import be.freenote.entity.User;
import be.freenote.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.NonNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Re-checks the STAFF status (admin role + moderator/editor flags, V18) against the database, so the
 * DB is the single source of truth — not the (up to 24h stale) JWT claim:
 *  - a DEMOTED admin/moderator/editor loses access immediately, not when the token expires;
 *  - a freshly PROMOTED user gains access immediately — the filter grants the authorities from the
 *    DB even if their JWT predates the promotion, so no re-login is required (same live-from-DB
 *    philosophy as the {@code trusted} flag).
 *
 * <p>Runs on every /api/admin/** request, AND on any request whose JWT claims ROLE_ADMIN: outside
 * the panel that claim still unlocks other people's quizzes/decks/charts, actuator and the rate-limit
 * bypass. The staff authorities are REBUILT from the DB (removed as well as added) — only adding
 * them left a demoted admin's ROLE_ADMIN in place.</p>
 *
 * <p>The admin path is matched like SecurityConfig and Spring MVC match it, on the DECODED path: a
 * raw {@code startsWith("/api/admin/")} let {@code /api/%61dmin/...} reach the panel without this
 * check while both the security matchers and the controller mapping decoded it to /api/admin.</p>
 *
 * <p>The filter only decides "is this person staff at all?" — WHICH /api/admin/** paths a
 * moderator or editor may reach is enforced by the SecurityConfig matchers (moderation subset for
 * ROLE_MODERATOR, guides for ROLE_EDITOR, everything else stays ROLE_ADMIN).</p>
 */
@Component
@RequiredArgsConstructor
public class AdminRoleVerificationFilter extends OncePerRequestFilter {

    private static final RequestMatcher ADMIN_PATHS =
            PathPatternRequestMatcher.withDefaults().matcher("/api/admin/**");
    private static final Set<String> STAFF_ROLES = Set.of("ROLE_ADMIN", "ROLE_MODERATOR", "ROLE_EDITOR");

    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            filterChain.doFilter(request, response);
            return;
        }

        boolean adminPath = isAdminPath(request);
        boolean claimsAdmin = auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        if (!adminPath && !claimsAdmin) {
            // Cas courant : un étudiant hors du panel — aucune requête en base.
            filterChain.doFilter(request, response);
            return;
        }

        User user = userRepository.findById(userId).orElse(null);
        boolean admin = user != null && "ADMIN".equals(user.getRole());
        boolean moderator = user != null && user.isModerator();
        boolean editor = user != null && user.isEditor();

        if (adminPath && !admin && !moderator && !editor) {
            SecurityContextHolder.clearContext();
            response.setStatus(HttpStatus.FORBIDDEN.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"status\":403,\"message\":\"Access denied\"}");
            return;
        }

        // Rôles staff reconstruits depuis la base : ceux du jeton sont ignorés (un admin rétrogradé
        // perd ROLE_ADMIN), ceux de la base sont posés (moderator/editor ne sont JAMAIS dans le JWT).
        List<GrantedAuthority> authorities = new ArrayList<>();
        for (GrantedAuthority a : auth.getAuthorities()) {
            if (!STAFF_ROLES.contains(a.getAuthority())) {
                authorities.add(a);
            }
        }
        if (admin) authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
        if (moderator) authorities.add(new SimpleGrantedAuthority("ROLE_MODERATOR"));
        if (editor) authorities.add(new SimpleGrantedAuthority("ROLE_EDITOR"));

        if (!names(authorities).equals(names(auth.getAuthorities()))) {
            UsernamePasswordAuthenticationToken rebuilt =
                    new UsernamePasswordAuthenticationToken(auth.getPrincipal(), auth.getCredentials(), authorities);
            rebuilt.setDetails(auth.getDetails());
            SecurityContextHolder.getContext().setAuthentication(rebuilt);
        }

        filterChain.doFilter(request, response);
    }

    static boolean isAdminPath(HttpServletRequest request) {
        return ADMIN_PATHS.matches(request);
    }

    private static Set<String> names(java.util.Collection<? extends GrantedAuthority> authorities) {
        Set<String> names = new HashSet<>();
        authorities.forEach(a -> names.add(a.getAuthority()));
        return names;
    }
}
