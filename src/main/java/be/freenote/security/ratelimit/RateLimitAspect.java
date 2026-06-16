package be.freenote.security.ratelimit;

import be.freenote.exception.RateLimitExceededException;
import be.freenote.service.RateLimitService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class RateLimitAspect {

    private final RateLimitService rateLimitService;

    @Around("@annotation(rateLimit)")
    public Object enforce(ProceedingJoinPoint joinPoint, RateLimit rateLimit) throws Throwable {
        String key = resolveKey(joinPoint);
        if (!rateLimitService.isAllowed(key, rateLimit.max(), rateLimit.window())) {
            long retryAfter = rateLimitService.retryAfterSeconds(key);
            log.warn("Rate limit exceeded: key={} (retryAfter={}s)", key, retryAfter);
            throw new RateLimitExceededException("Rate limit exceeded. Try again later.", retryAfter);
        }
        return joinPoint.proceed();
    }

    private String resolveKey(ProceedingJoinPoint joinPoint) {
        String method = joinPoint.getSignature().toShortString();

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Long userId) {
            return method + ":user:" + userId;
        }

        // En production derrière Nginx, configurer server.forward-headers-strategy=NATIVE
        // et les trusted proxies pour que getRemoteAddr() retourne le vrai IP client.
        ServletRequestAttributes attrs =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs != null) {
            HttpServletRequest request = attrs.getRequest();
            return method + ":ip:" + request.getRemoteAddr();
        }

        return method + ":unknown";
    }
}
