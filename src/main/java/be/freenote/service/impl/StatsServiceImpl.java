package be.freenote.service.impl;

import be.freenote.dto.response.StatsResponse;
import be.freenote.repository.CourseRepository;
import be.freenote.repository.DocumentRepository;
import be.freenote.repository.SectionRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@org.springframework.transaction.annotation.Transactional(readOnly = true)
public class StatsServiceImpl implements StatsService {

    // « :v2 » : le record StatsResponse a gagné le champ `sections` — une valeur encore en cache
    // sous l'ancienne forme au moment du déploiement ne doit pas exploser à la désérialisation.
    private static final String CACHE_KEY = "stats:global:v2";
    private static final Duration CACHE_TTL = Duration.ofMinutes(5);

    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final CourseRepository courseRepository;
    private final SectionRepository sectionRepository;
    private final RedisTemplate<String, Object> redisTemplate;

    @Override
    public void invalidateCache() {
        redisTemplate.delete(CACHE_KEY);
    }

    @Override
    public StatsResponse getStats() {
        Object cached = redisTemplate.opsForValue().get(CACHE_KEY);
        if (cached instanceof StatsResponse stats) {
            return stats;
        }

        long totalDocs = documentRepository.count();
        long totalDownloads = documentRepository.sumDownloadCount();
        long totalContributors = userRepository.count();
        long totalCourses = courseRepository.count();
        long weekUploads = documentRepository.countByCreatedAtAfter(LocalDateTime.now().minusDays(7));
        // Docs par section, plus actives d'abord — la constellation du hero s'en nourrit.
        List<StatsResponse.SectionStat> sections = sectionRepository.findAllApprovedWithDocCount().stream()
                .map(s -> new StatsResponse.SectionStat(s.getName(), s.getDocumentCount() == null ? 0 : s.getDocumentCount()))
                .sorted(Comparator.comparingLong(StatsResponse.SectionStat::documentCount).reversed())
                .toList();

        StatsResponse stats = new StatsResponse(totalDocs, totalDownloads, totalContributors,
                totalCourses, weekUploads, sections);

        redisTemplate.opsForValue().set(CACHE_KEY, stats, CACHE_TTL);
        return stats;
    }
}
