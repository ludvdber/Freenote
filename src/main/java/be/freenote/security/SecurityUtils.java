package be.freenote.security;

import org.springframework.security.core.Authentication;

/**
 * Helpers around the authenticated principal. {@link JwtAuthFilter} stores the user's
 * {@code Long} id as the principal, so every controller that needs "the current user id"
 * goes through here instead of repeating the cast.
 */
public final class SecurityUtils {

    private SecurityUtils() {}

    /** The authenticated user's id. Assumes the request passed {@link JwtAuthFilter}. */
    public static Long currentUserId(Authentication authentication) {
        return (Long) authentication.getPrincipal();
    }

    /** The authenticated user's id, or {@code null} on an anonymous request — for the few
     *  {@code permitAll} endpoints whose behaviour varies with the caller (révision publique) :
     *  sans JWT, le principal est le {@code String} "anonymousUser" de Spring, jamais un Long. */
    public static Long currentUserIdOrNull(Authentication authentication) {
        return authentication != null && authentication.getPrincipal() instanceof Long id ? id : null;
    }
}
