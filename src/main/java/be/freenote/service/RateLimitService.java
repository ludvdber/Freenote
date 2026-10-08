package be.freenote.service;

public interface RateLimitService {
    boolean isAllowed(String key, int max, long windowSeconds);

    /** Remaining seconds before the window resets — for the {@code Retry-After} header. 0 if unknown. */
    long retryAfterSeconds(String key);

    /**
     * Vrai au PREMIER refus d'une fenêtre pour cette clé, faux ensuite : de quoi signaler une
     * limite atteinte une seule fois, pas à chaque appel refusé (qui insiste remplirait le journal).
     */
    boolean firstRejectionInWindow(String key);
}
