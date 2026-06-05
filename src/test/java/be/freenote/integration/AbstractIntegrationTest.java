package be.freenote.integration;

import be.freenote.entity.*;
import be.freenote.enums.Category;
import be.freenote.repository.*;
import be.freenote.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import java.time.Duration;

/**
 * Base class for integration tests. Starts PostgreSQL, Redis, MinIO and Meilisearch via
 * Testcontainers using the singleton pattern so that containers are shared across all test classes
 * even when Spring creates separate ApplicationContexts (different @MockitoBean sets). MinIO and
 * Meilisearch are containerised too — the full Spring context connects to both at startup
 * ({@code MinioServiceImpl.initBucket}, {@code MeilisearchServiceImpl.initIndex}), so without them
 * the context fails to load on a clean CI runner (no local {@code docker compose} to lean on).
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.autoconfigure.exclude=org.springframework.boot.mail.autoconfigure.MailHealthContributorAutoConfiguration"
)
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class AbstractIntegrationTest {

    static final PostgreSQLContainer postgres = createPostgres();
    static final GenericContainer<?> redis = createRedis();
    static final GenericContainer<?> minio = createMinio();
    static final GenericContainer<?> meilisearch = createMeilisearch();

    static {
        postgres.start();
        redis.start();
        minio.start();
        meilisearch.start();
    }

    @SuppressWarnings("resource")
    private static PostgreSQLContainer createPostgres() {
        return new PostgreSQLContainer(
                DockerImageName.parse("pgvector/pgvector:pg17")
        ).withDatabaseName("freenote_test")
         .withUsername("freenote")
         .withPassword("freenote");
    }

    @SuppressWarnings("resource")
    private static GenericContainer<?> createRedis() {
        return new GenericContainer<>(
                DockerImageName.parse("redis:7-alpine")
        ).withExposedPorts(6379);
    }

    @SuppressWarnings("resource")
    private static GenericContainer<?> createMinio() {
        return new GenericContainer<>(DockerImageName.parse("minio/minio:latest"))
                .withCommand("server", "/data")
                .withEnv("MINIO_ROOT_USER", "minioadmin")
                .withEnv("MINIO_ROOT_PASSWORD", "minioadmin")
                .withExposedPorts(9000)
                .waitingFor(Wait.forHttp("/minio/health/live").forPort(9000)
                        .withStartupTimeout(Duration.ofSeconds(60)));
    }

    @SuppressWarnings("resource")
    private static GenericContainer<?> createMeilisearch() {
        return new GenericContainer<>(DockerImageName.parse("getmeili/meilisearch:latest"))
                .withEnv("MEILI_MASTER_KEY", "test-master-key")
                .withEnv("MEILI_NO_ANALYTICS", "true")
                .withExposedPorts(7700)
                .waitingFor(Wait.forHttp("/health").forPort(7700)
                        .withStartupTimeout(Duration.ofSeconds(60)));
    }

    @DynamicPropertySource
    static void containerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
        registry.add("app.minio.endpoint",
                () -> "http://" + minio.getHost() + ":" + minio.getMappedPort(9000));
        registry.add("app.meilisearch.host",
                () -> "http://" + meilisearch.getHost() + ":" + meilisearch.getMappedPort(7700));
    }

    @Autowired protected MockMvc mockMvc;
    @Autowired protected JwtTokenProvider jwtTokenProvider;
    @Autowired protected StringRedisTemplate redisTemplate;

    @Autowired protected UserRepository userRepository;
    @Autowired protected SectionRepository sectionRepository;
    @Autowired protected CourseRepository courseRepository;
    @Autowired protected DocumentRepository documentRepository;
    @Autowired protected RatingRepository ratingRepository;
    @Autowired protected FavoriteRepository favoriteRepository;
    @Autowired protected DonationRepository donationRepository;

    // --- Factory helpers ---

    protected User createUser(String username, boolean verified, String role) {
        User user = User.builder()
                .username(username)
                .verified(verified)
                .role(role)
                .xp(0)
                .build();
        user = userRepository.save(user);
        UserProfile profile = UserProfile.builder().user(user).build();
        user.setProfile(profile);
        be.freenote.entity.UserOauthLink link = be.freenote.entity.UserOauthLink.builder()
                .user(user)
                .provider("DISCORD")
                .oauthId("oauth-" + username)
                .build();
        user.getOauthLinks().add(link);
        return userRepository.save(user);
    }

    protected User createVerifiedUser(String username) {
        return createUser(username, true, "USER");
    }

    protected Section createSection(String name) {
        return sectionRepository.save(
                Section.builder().name(name).approved(true).build()
        );
    }

    protected Course createCourse(String name, Section section, User createdBy) {
        return courseRepository.save(
                Course.builder().name(name).section(section).approved(true).createdBy(createdBy).build()
        );
    }

    protected Document createDocument(String title, Course course, User user) {
        return documentRepository.save(
                Document.builder()
                        .title(title)
                        .course(course)
                        .user(user)
                        .category(Category.SYNTHESE)
                        .fileKey("test/" + title.toLowerCase().replace(' ', '-') + ".pdf")
                        .fileSize(1024L)
                        .language("FR")
                        .build()
        );
    }

    protected String jwtFor(User user) {
        return jwtTokenProvider.generateToken(user);
    }
}
