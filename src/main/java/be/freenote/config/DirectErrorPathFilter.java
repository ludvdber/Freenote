package be.freenote.config;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.jspecify.annotations.NonNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Un appel DIRECT à /error (pas un renvoi interne après une vraie erreur) répondait 500 avec un
 * statut « 999 » : le BasicErrorController de Spring Boot ne trouve aucun code d'erreur dans la
 * requête et retombe sur 500. Un robot qui sonde l'adresse voyait donc une « panne » qui n'en est
 * pas une. On répond la même 404 que pour toute adresse inconnue.
 *
 * <p>Les vraies erreurs passent par un dispatch ERROR, que {@link OncePerRequestFilter} ne filtre
 * pas par défaut : elles continuent d'atteindre le contrôleur d'erreur normalement.</p>
 */
@Component
public class DirectErrorPathFilter extends OncePerRequestFilter {

    private static final RequestMatcher ERROR_PATH =
            PathPatternRequestMatcher.withDefaults().matcher("/error");

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        // Ceinture et bretelles : OncePerRequestFilter reconnaît le renvoi d'erreur à l'attribut
        // jakarta.servlet.error.request_uri ; on n'agit en plus que sur une requête directe.
        return request.getDispatcherType() != DispatcherType.REQUEST || !ERROR_PATH.matches(request);
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        response.setStatus(HttpStatus.NOT_FOUND.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"status\":404,\"message\":\"Endpoint not found\"}");
    }
}
