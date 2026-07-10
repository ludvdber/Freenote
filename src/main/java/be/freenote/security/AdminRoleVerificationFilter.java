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
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Re-checks the STAFF status (admin role + moderator/editor flags, V18) against the database for
 * every /api/admin/** request, so the DB is the single source of truth — not the (up to 24h stale)
 * JWT claim:
 *  - a DEMOTED admin/moderator/editor loses access immediately (403), not when the token expires;
 *  - a freshly PROMOTED user gains access immediately — the filter grants the authorities from the
 *    DB even if their JWT predates the promotion, so no re-login is required (same live-from-DB
 *    philosophy as the {@code trusted} flag).
 *
 * <p>The filter only decides "is this person staff at all?" — WHICH /api/admin/** paths a
 * moderator or editor may reach is enforced by the SecurityConfig matchers (moderation subset for
 * ROLE_MODERATOR, guides for ROLE_EDITOR, everything else stays ROLE_ADMIN).
 */
@Component
@RequiredArgsConstructor
public class AdminRoleVerificationFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/admin/");
    }

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

        User user = userRepository.findById(userId).orElse(null);
        boolean admin = user != null && "ADMIN".equals(user.getRole());
        boolean moderator = user != null && user.isModerator();
        boolean editor = user != null && user.isEditor();

        if (!admin && !moderator && !editor) {
            SecurityContextHolder.clearContext();
            response.setStatus(HttpStatus.FORBIDDEN.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"status\":403,\"message\":\"Access denied\"}");
            return;
        }

        // The DB confirms a staff status the JWT may not carry (promotion after token issuance, or
        // moderator/editor which are NEVER in the JWT). Grant the missing authorities so the
        // downstream authorization rules (hasRole/hasAnyRole) see the live truth.
        List<GrantedAuthority> authorities = new ArrayList<>(auth.getAuthorities());
        boolean changed = false;
        changed |= grantIfMissing(authorities, admin, "ROLE_ADMIN");
        changed |= grantIfMissing(authorities, moderator, "ROLE_MODERATOR");
        changed |= grantIfMissing(authorities, editor, "ROLE_EDITOR");
        if (changed) {
            UsernamePasswordAuthenticationToken upgraded =
                    new UsernamePasswordAuthenticationToken(auth.getPrincipal(), auth.getCredentials(), authorities);
            upgraded.setDetails(auth.getDetails());
            SecurityContextHolder.getContext().setAuthentication(upgraded);
        }

        filterChain.doFilter(request, response);
    }

    private static boolean grantIfMissing(List<GrantedAuthority> authorities, boolean granted, String role) {
        if (!granted || authorities.stream().anyMatch(a -> role.equals(a.getAuthority()))) {
            return false;
        }
        authorities.add(new SimpleGrantedAuthority(role));
        return true;
    }
}
