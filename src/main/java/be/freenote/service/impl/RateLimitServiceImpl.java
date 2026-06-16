package be.freenote.service.impl;

import be.freenote.service.RateLimitService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
public class RateLimitServiceImpl implements RateLimitService {

    private final StringRedisTemplate redisTemplate;

    @Override
    public boolean isAllowed(String key, int max, long windowSeconds) {
        String redisKey = "rate:" + key;
        Long count = redisTemplate.opsForValue().increment(redisKey);
        if (count != null && count == 1) {
            redisTemplate.expire(redisKey, Duration.ofSeconds(windowSeconds));
        }
        return count != null && count <= max;
    }

    @Override
    public long retryAfterSeconds(String key) {
        Long ttl = redisTemplate.getExpire("rate:" + key);
        return ttl != null && ttl > 0 ? ttl : 0;
    }
}
