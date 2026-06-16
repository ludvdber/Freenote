package be.freenote.service;

public interface RateLimitService {
    boolean isAllowed(String key, int max, long windowSeconds);

    /** Remaining seconds before the window resets — for the {@code Retry-After} header. 0 if unknown. */
    long retryAfterSeconds(String key);
}
