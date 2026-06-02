package be.freenote.service;

import be.freenote.entity.User;
import be.freenote.entity.UserOauthLink;
import be.freenote.exception.RateLimitExceededException;
import be.freenote.exception.UnauthorizedException;
import be.freenote.repository.BanRepository;
import be.freenote.repository.UserOauthLinkRepository;
import be.freenote.repository.UserRepository;
import be.freenote.security.JwtTokenProvider;
import be.freenote.service.impl.AuthServiceImpl;
import be.freenote.util.HashUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.test.util.ReflectionTestUtils;

import jakarta.mail.internet.MimeMessage;
import java.time.Duration;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock private UserRepository userRepository;
    @Mock private UserOauthLinkRepository oauthLinkRepository;
    @Mock private BanRepository banRepository;
    @Mock private JwtTokenProvider jwtTokenProvider;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private JavaMailSender mailSender;
    @Mock private SmtpKeepAliveService smtpKeepAliveService;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private MimeMessage mimeMessage;

    @InjectMocks private AuthServiceImpl authService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(authService, "emailHashSalt", "test-salt");
        ReflectionTestUtils.setField(authService, "mailFrom", "noreply@test.be");
    }

    // ---- processOAuth2Login ----

    @Test
    void shouldReuseExistingUserOnOAuth2Login() {
        OAuth2User oAuth2User = mock(OAuth2User.class);
        when(oAuth2User.getName()).thenReturn("oauth-id-123");

        User existingUser = User.builder().id(1L).username("test").build();
        UserOauthLink link = UserOauthLink.builder()
                .user(existingUser).provider("DISCORD").oauthId("oauth-id-123").build();
        when(oauthLinkRepository.findByProviderAndOauthId("DISCORD", "oauth-id-123"))
                .thenReturn(Optional.of(link));

        authService.processOAuth2Login(oAuth2User, "discord");

        verify(userRepository, never()).save(any());
    }

    @Test
    void shouldCreateProvisionalUserOnOAuth2LoginWithNewUser() {
        OAuth2User oAuth2User = mock(OAuth2User.class);
        when(oAuth2User.getName()).thenReturn("new-id");
        lenient().when(oAuth2User.getAttribute("email_verified")).thenReturn(null);

        when(oauthLinkRepository.findByProviderAndOauthId("DISCORD", "new-id"))
                .thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(oauthLinkRepository.save(any(UserOauthLink.class))).thenAnswer(inv -> inv.getArgument(0));

        authService.processOAuth2Login(oAuth2User, "discord");

        // Username is NOT derived from Discord — a provisional placeholder is created and the account
        // is flagged as not-yet-chosen so onboarding forces the user to pick a real pseudo.
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository, atLeastOnce()).save(captor.capture());
        User created = captor.getAllValues().getFirst();
        assertThat(created.isUsernameChosen()).isFalse();
        assertThat(created.getUsername()).startsWith("membre-");
    }

    @Test
    void shouldRejectBannedDiscordIdentity() {
        OAuth2User oAuth2User = mock(OAuth2User.class);
        when(oAuth2User.getName()).thenReturn("banned-id");
        lenient().when(oAuth2User.getAttribute("email_verified")).thenReturn(null);
        when(banRepository.existsByOauthProviderAndOauthId("DISCORD", "banned-id")).thenReturn(true);

        assertThatThrownBy(() -> authService.processOAuth2Login(oAuth2User, "discord"))
                .isInstanceOf(org.springframework.security.oauth2.core.OAuth2AuthenticationException.class);

        verify(userRepository, never()).save(any());
    }

    @Test
    void shouldUppercaseRegistrationId() {
        OAuth2User oAuth2User = mock(OAuth2User.class);
        when(oAuth2User.getName()).thenReturn("id1");

        User user = User.builder().id(1L).username("u").build();
        UserOauthLink link = UserOauthLink.builder().user(user).provider("DISCORD").oauthId("id1").build();
        when(oauthLinkRepository.findByProviderAndOauthId("DISCORD", "id1"))
                .thenReturn(Optional.of(link));

        authService.processOAuth2Login(oAuth2User, "Discord");

        verify(oauthLinkRepository).findByProviderAndOauthId("DISCORD", "id1");
    }

    // ---- requestVerification ----

    @Test
    void shouldSendCodeWhenValidIsfceEmail() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(userRepository.findByEmailHash(anyString())).thenReturn(Optional.empty());
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        authService.requestVerification(1L, "student@isfce.be");

        verify(valueOps).set(eq("verify:1"), anyString(), eq(Duration.ofMinutes(15)));
        verify(mailSender).send(mimeMessage);
    }

    @Test
    void shouldStoreCodeAndEmailHashInRedis() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(userRepository.findByEmailHash(anyString())).thenReturn(Optional.empty());
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        authService.requestVerification(42L, "test@isfce.be");

        ArgumentCaptor<String> valueCaptor = ArgumentCaptor.forClass(String.class);
        verify(valueOps).set(eq("verify:42"), valueCaptor.capture(), eq(Duration.ofMinutes(15)));

        String storedValue = valueCaptor.getValue();
        assertThat(storedValue).contains(":");
        String[] parts = storedValue.split(":", 2);
        assertThat(parts[0]).matches("\\d{6}"); // 6-digit code
        assertThat(parts[1]).isEqualTo(HashUtil.hashEmail("test@isfce.be", "test-salt"));
    }

    @Test
    void shouldThrowServiceUnavailableWhenSmtpFails() {
        // JavaMailSender.send throws a MailException (unchecked) when SMTP is unreachable.
        // It must be caught and surfaced as a clean 503, not bubble up as a raw 500.
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(userRepository.findByEmailHash(anyString())).thenReturn(Optional.empty());
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        doThrow(new org.springframework.mail.MailSendException("SMTP down"))
                .when(mailSender).send(any(MimeMessage.class));

        assertThatThrownBy(() -> authService.requestVerification(1L, "student@isfce.be"))
                .isInstanceOf(be.freenote.exception.ServiceUnavailableException.class);
    }

    @Test
    void shouldThrowWhenInvalidEmail() {
        assertThatThrownBy(() -> authService.requestVerification(1L, "user@gmail.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ISFCE");
    }

    @Test
    void shouldThrowWhenSubdomainEmail() {
        assertThatThrownBy(() -> authService.requestVerification(1L, "user@sub.isfce.be"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldAcceptUppercaseIsfceEmail() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(userRepository.findByEmailHash(anyString())).thenReturn(Optional.empty());
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        assertThatCode(() -> authService.requestVerification(1L, "Student@ISFCE.BE"))
                .doesNotThrowAnyException();
    }

    @Test
    void shouldSilentlyNoopWhenEmailHashAlreadyExists() {
        // Returning a distinct error would leak which emails are already registered (enumeration attack).
        // The service should silently return without sending an email or storing a verification code.
        User existing = User.builder().id(99L).build();
        when(userRepository.findByEmailHash(anyString())).thenReturn(Optional.of(existing));

        authService.requestVerification(1L, "student@isfce.be");

        verifyNoInteractions(mailSender);
        verifyNoInteractions(redisTemplate);
    }

    // ---- confirmVerification ----

    @Test
    void shouldVerifyUserWhenCorrectCode() {
        String emailHash = HashUtil.hashEmail("test@isfce.be", "test-salt");
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.increment("verify-attempts:1")).thenReturn(1L);
        when(valueOps.get("verify:1")).thenReturn("123456:" + emailHash);

        User user = User.builder().id(1L).username("test").verified(false).role("USER").build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenReturn(user);
        when(jwtTokenProvider.generateToken(user)).thenReturn("verified-jwt");

        String jwt = authService.confirmVerification(1L, "123456");

        assertThat(jwt).isEqualTo("verified-jwt");
        assertThat(user.isVerified()).isTrue();
        assertThat(user.getEmailHash()).isEqualTo(emailHash);
        verify(redisTemplate).delete("verify:1");
        verify(redisTemplate).delete("verify-attempts:1");
    }

    @Test
    void shouldThrowWhenIncorrectCode() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.increment("verify-attempts:1")).thenReturn(1L);
        when(valueOps.get("verify:1")).thenReturn("123456:somehash");

        assertThatThrownBy(() -> authService.confirmVerification(1L, "000000"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("Invalid");
    }

    @Test
    void shouldThrowWhenCodeExpired() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.increment("verify-attempts:1")).thenReturn(1L);
        when(valueOps.get("verify:1")).thenReturn(null);

        assertThatThrownBy(() -> authService.confirmVerification(1L, "123456"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("expired");
    }

    @Test
    void shouldBlockAfter5FailedAttempts() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.increment("verify-attempts:1")).thenReturn(6L);

        assertThatThrownBy(() -> authService.confirmVerification(1L, "000000"))
                .isInstanceOf(RateLimitExceededException.class);

        verify(redisTemplate).delete("verify:1");
        verify(redisTemplate).delete("verify-attempts:1");
    }

    @Test
    void shouldSetExpireOnFirstAttemptOnly() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.increment("verify-attempts:1")).thenReturn(1L);
        when(valueOps.get("verify:1")).thenReturn("123456:hash");

        User user = User.builder().id(1L).username("t").verified(false).role("USER").build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenReturn(user);
        when(jwtTokenProvider.generateToken(any())).thenReturn("jwt");

        authService.confirmVerification(1L, "123456");

        verify(redisTemplate).expire("verify-attempts:1", Duration.ofMinutes(15));
    }

    @Test
    void shouldNotSetExpireOnSubsequentAttempts() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.increment("verify-attempts:1")).thenReturn(3L);
        when(valueOps.get("verify:1")).thenReturn("123456:hash");

        User user = User.builder().id(1L).username("t").verified(false).role("USER").build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenReturn(user);
        when(jwtTokenProvider.generateToken(any())).thenReturn("jwt");

        authService.confirmVerification(1L, "123456");

        verify(redisTemplate, never()).expire(eq("verify-attempts:1"), any(Duration.class));
    }
}
