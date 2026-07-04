package be.freenote.security;

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
 * Re-checks the admin role against the database for every /api/admin/** request, so the DB is the
 * single source of truth for admin access — not the (up to 24h stale) JWT claim:
 *  - a DEMOTED admin loses access immediately (403), not when the token expires;
 *  - a freshly PROMOTED user gains access immediately — this filter grants ROLE_ADMIN from the DB
 *    even if their JWT was issued before the promotion, so no re-login is required (same live-from-DB
 *    philosophy as the {@code trusted} flag).
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

        boolean stillAdmin = userRepository.findById(userId)
                .map(u -> "ADMIN".equals(u.getRole()))
                .orElse(false);

        if (!stillAdmin) {
            SecurityContextHolder.clearContext();
            response.setStatus(HttpStatus.FORBIDDEN.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"status\":403,\"message\":\"Access denied\"}");
            return;
        }

        // DB confirms ADMIN. If the JWT was issued before the promotion it lacks ROLE_ADMIN, which
        // would make the downstream authorization (hasRole("ADMIN")) reject the request. Grant the
        // authority from the DB so a promotion takes effect immediately, without a re-login.
        boolean hasAdminAuthority = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        if (!hasAdminAuthority) {
            List<GrantedAuthority> authorities = new ArrayList<>(auth.getAuthorities());
            authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
            UsernamePasswordAuthenticationToken upgraded =
                    new UsernamePasswordAuthenticationToken(auth.getPrincipal(), auth.getCredentials(), authorities);
            upgraded.setDetails(auth.getDetails());
            SecurityContextHolder.getContext().setAuthentication(upgraded);
        }

        filterChain.doFilter(request, response);
    }
}
