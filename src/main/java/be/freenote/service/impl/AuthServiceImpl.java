package be.freenote.service.impl;

import be.freenote.entity.User;
import be.freenote.entity.UserOauthLink;
import be.freenote.entity.UserProfile;
import be.freenote.enums.AvatarSource;
import be.freenote.enums.ActivityType;
import be.freenote.exception.ForbiddenException;
import be.freenote.exception.RateLimitExceededException;
import be.freenote.exception.ServiceUnavailableException;
import be.freenote.repository.BanRepository;
import be.freenote.repository.Repositories;
import be.freenote.repository.UserOauthLinkRepository;
import be.freenote.repository.UserRepository;
import be.freenote.security.JwtTokenProvider;
import be.freenote.service.ActivityLogService;
import be.freenote.service.AuthService;
import be.freenote.service.SmtpKeepAliveService;
import be.freenote.util.HashUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.UUID;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private static final Pattern ISFCE_EMAIL_PATTERN =
            Pattern.compile("^[a-zA-Z0-9._%+-]+@isfce\\.be$", Pattern.CASE_INSENSITIVE);

    private final UserRepository userRepository;
    private final UserOauthLinkRepository oauthLinkRepository;
    private final BanRepository banRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final StringRedisTemplate redisTemplate;
    private final JavaMailSender mailSender;
    private final SmtpKeepAliveService smtpKeepAliveService;
    private final ActivityLogService activityLogService;

    @Value("${app.email.hash-salt}")
    private String emailHashSalt;

    // Expéditeur des mails transactionnels. DOIT correspondre au domaine authentifié chez le
    // fournisseur SMTP (Brevo) — sinon SPF/DKIM échouent et le mail tombe en spam.
    @Value("${app.email.from:noreply@freenote.be}")
    private String mailFrom;

    private final SecureRandom secureRandom = new SecureRandom();

    @Override
    @Transactional
    public void processOAuth2Login(OAuth2User oAuth2User, String registrationId) {
        String provider = registrationId.toUpperCase();
        String oauthId = oAuth2User.getName();

        Boolean emailVerified = oAuth2User.getAttribute("email_verified");
        if (Boolean.FALSE.equals(emailVerified)) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("unverified_email", "OAuth provider email is not verified", null));
        }

        // Banned Discord identity: refuse login outright (cannot re-create an account).
        if (banRepository.existsByOauthProviderAndOauthId(provider, oauthId)) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("account_banned", "This account has been banned", null));
        }

        // Find the linked account, or provision a new one. The JWT cookie is minted later by
        // OAuth2LoginSuccessHandler — this method only ensures the account exists. For a returning
        // user we refresh the captured Discord avatar so a profile-picture change propagates.
        oauthLinkRepository.findByProviderAndOauthId(provider, oauthId)
                .ifPresentOrElse(
                        link -> {
                            User user = link.getUser();
                            refreshDiscordAvatar(user, oAuth2User, oauthId);
                            activityLogService.log(ActivityType.LOGIN, user.getId(), user.getUsername(), "Connexion");
                        },
                        () -> {
                            User created = createUserFromOAuth(oAuth2User, provider, oauthId);
                            // actorId null: the new account isn't committed yet, so the REQUIRES_NEW
                            // log tx can't satisfy the FK — only a name snapshot is kept. The internal
                            // username is the throwaway "membre-xxxx" placeholder at this point (the
                            // user picks a real pseudo during onboarding), so snapshot the Discord
                            // handle instead — it's the only human-readable identity available here.
                            String discordHandle = discordUsername(oAuth2User);
                            activityLogService.log(ActivityType.SIGNUP, null,
                                    discordHandle != null ? discordHandle : created.getUsername(),
                                    "Création de compte via Discord");
                        });
    }

    private User createUserFromOAuth(OAuth2User oAuth2User, String provider, String oauthId) {
        // Provisional account: the username is NOT derived from Discord — the user picks it during
        // onboarding (usernameChosen=false gates the app until then). Discord only provides auth +
        // the profile picture. A throwaway placeholder keeps the NOT NULL/unique constraint happy.
        User newUser = User.builder()
                .username(uniqueUsername("membre-" + UUID.randomUUID().toString().substring(0, 8)))
                .usernameChosen(false)
                .build();
        User saved = userRepository.save(newUser);

        UserProfile profile = UserProfile.builder()
                .user(saved)
                .avatarSource(AvatarSource.DISCORD)
                .discordAvatarUrl(discordAvatarUrl(oAuth2User, oauthId))
                // Pre-fill the Discord social field from the OAuth identity (login is Discord-only).
                // The user can still edit/clear it later, so it's set only at creation.
                .discord(discordUsername(oAuth2User))
                .build();
        saved.setProfile(profile);

        UserOauthLink link = UserOauthLink.builder()
                .user(saved)
                .provider(provider)
                .oauthId(oauthId)
                .build();
        oauthLinkRepository.save(link);

        return userRepository.save(saved);
    }

    /** Appends a numeric suffix until the username is free (placeholder collisions are astronomically rare). */
    private String uniqueUsername(String base) {
        String candidate = base;
        int suffix = 1;
        while (userRepository.existsByUsername(candidate)) {
            candidate = base + suffix++;
        }
        return candidate;
    }

    /** Builds the Discord CDN avatar URL from the OAuth attributes, or null if the user has no custom avatar. */
    private static String discordAvatarUrl(OAuth2User oAuth2User, String oauthId) {
        Object avatar = oAuth2User.getAttribute("avatar");
        if (avatar == null) return null;
        return "https://cdn.discordapp.com/avatars/" + oauthId + "/" + avatar + ".png";
    }

    /** The Discord handle (prefers the display name {@code global_name}, falls back to {@code username}). */
    private static String discordUsername(OAuth2User oAuth2User) {
        Object globalName = oAuth2User.getAttribute("global_name");
        if (globalName instanceof String s && !s.isBlank()) return s;
        Object username = oAuth2User.getAttribute("username");
        return username instanceof String s && !s.isBlank() ? s : null;
    }

    /** Re-captures the latest Discord avatar on each login so a profile-picture change on Discord
     *  propagates to the user's Freenote avatar (the stored URL is otherwise a one-time snapshot).
     *  Runs inside the {@code @Transactional} login flow, so the dirty profile is flushed on commit. */
    private void refreshDiscordAvatar(User user, OAuth2User oAuth2User, String oauthId) {
        UserProfile profile = user.getProfile();
        if (profile == null) return;
        profile.setDiscordAvatarUrl(discordAvatarUrl(oAuth2User, oauthId));
    }

    @Override
    public void requestVerification(Long userId, String email) {
        if (!ISFCE_EMAIL_PATTERN.matcher(email).matches()) {
            throw new IllegalArgumentException("Email must be an ISFCE email address (@isfce.be)");
        }

        String emailHash = HashUtil.hashEmail(email, emailHashSalt);

        // Banned ISFCE email: refuse verification. The user is told (it's their own address, so no
        // enumeration of other accounts) — the only way back is a brand-new @isfce.be address.
        if (banRepository.existsByEmailHash(emailHash)) {
            throw new ForbiddenException("Cette adresse @isfce.be a été bannie");
        }

        // Silently no-op if this email is already claimed by another account.
        // Returning a distinct error would let an attacker enumerate registered @isfce.be emails.
        if (userRepository.findByEmailHash(emailHash).isPresent()) {
            log.info("Verification request for an already-claimed email (userId={}). Silently ignored.", userId);
            return;
        }

        String code = generateCode();
        redisTemplate.opsForValue().set("verify:" + userId, code + ":" + emailHash, Duration.ofMinutes(15));

        sendVerificationEmail(email, code);
    }

    @Override
    @Transactional
    public String confirmVerification(Long userId, String code) {
        String attemptsKey = "verify-attempts:" + userId;
        Long attempts = redisTemplate.opsForValue().increment(attemptsKey);
        if (attempts != null && attempts == 1) {
            redisTemplate.expire(attemptsKey, Duration.ofMinutes(15));
        }
        if (attempts != null && attempts > 5) {
            redisTemplate.delete("verify:" + userId);
            redisTemplate.delete(attemptsKey);
            log.warn("Verification rate limit reached for userId={}", userId);
            throw new RateLimitExceededException("Trop de tentatives, veuillez redemander un code");
        }

        String redisKey = "verify:" + userId;
        String storedValue = redisTemplate.opsForValue().get(redisKey);

        if (storedValue == null) {
            // 400, not 401: the user IS authenticated (provisional account) — an expired/missing
            // code is a bad request, not a session failure. A 401 here would trip the SPA's axios
            // interceptor into logging the user out and bouncing them to the home page.
            throw new IllegalArgumentException("Ce code a expiré. Demande un nouveau code.");
        }

        String[] parts = storedValue.split(":", 2);
        String storedCode = parts[0];
        String emailHash = parts[1];

        if (!storedCode.equals(code)) {
            throw new IllegalArgumentException("Code incorrect. Vérifie les 6 chiffres et réessaie.");
        }

        // Defence in depth: a ban could have been issued between request and confirm.
        if (banRepository.existsByEmailHash(emailHash)) {
            redisTemplate.delete(redisKey);
            throw new ForbiddenException("Cette adresse @isfce.be a été bannie");
        }

        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");

        user.setEmailHash(emailHash);
        user.setVerified(true);
        userRepository.save(user);

        redisTemplate.delete(redisKey);
        redisTemplate.delete(attemptsKey);

        return jwtTokenProvider.generateToken(user);
    }

    private String generateCode() {
        int code = 100000 + secureRandom.nextInt(900000);
        return String.valueOf(code);
    }

    private void sendVerificationEmail(String to, String code) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            // Display name "Freenote" so the inbox shows "Freenote" rather than the raw address.
            helper.setFrom(mailFrom, "Freenote");
            helper.setTo(to);
            helper.setSubject("Freenote — Ton code de vérification");
            // Email-safe HTML: table layout + inline styles + web-safe font fallbacks, in the
            // Freenote palette (dark navy, violet→cyan gradient). Literal % are doubled (%%) so
            // String.formatted() leaves the CSS gradient stops untouched and only injects the code.
            helper.setText(
                    """
                    <!DOCTYPE html>
                    <html lang="fr">
                    <head>
                      <meta charset="UTF-8">
                      <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    </head>
                    <body style="margin:0; padding:0; background-color:#0a0a1a;">
                      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#0a0a1a; padding:32px 12px;">
                        <tr>
                          <td align="center">
                            <table role="presentation" cellpadding="0" cellspacing="0" width="480" style="width:480px; max-width:480px; background-color:#12152b; border:1px solid rgba(255,255,255,0.08); border-radius:16px; overflow:hidden;">
                              <tr>
                                <td align="center" style="background:linear-gradient(135deg,#7c5cff 0%%,#22d3ee 100%%); background-color:#7c5cff; padding:26px 32px;">
                                  <span style="font-family:'Segoe UI',Arial,sans-serif; font-size:26px; font-weight:800; color:#ffffff; letter-spacing:0.5px;">Freenote</span>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding:32px; font-family:'Segoe UI',Arial,sans-serif;">
                                  <h1 style="margin:0 0 10px; font-size:20px; font-weight:700; color:#ffffff;">Ton code de vérification</h1>
                                  <p style="margin:0 0 24px; font-size:14px; line-height:1.6; color:#a9b0c6;">Entre ce code pour confirmer ton adresse <strong style="color:#e6e8f0;">@isfce.be</strong> et rejoindre ta promo sur Freenote.</p>
                                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
                                    <tr>
                                      <td align="center" style="background-color:#0a0a1a; border:1px solid rgba(124,92,255,0.45); border-radius:12px; padding:22px;">
                                        <span style="font-family:'JetBrains Mono','Courier New',monospace; font-size:34px; font-weight:700; letter-spacing:10px; color:#22d3ee;">%s</span>
                                      </td>
                                    </tr>
                                  </table>
                                  <p style="margin:24px 0 0; font-size:13px; line-height:1.6; color:#7c8198;">Ce code expire dans <strong style="color:#a9b0c6;">15 minutes</strong>. Si tu n'es pas à l'origine de cette demande, ignore simplement cet email.</p>
                                </td>
                              </tr>
                              <tr>
                                <td align="center" style="padding:18px 32px; border-top:1px solid rgba(255,255,255,0.06);">
                                  <p style="margin:0; font-family:'Segoe UI',Arial,sans-serif; font-size:12px; color:#6b7088;">Freenote — Hub des documents des étudiants ISFCE</p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </body>
                    </html>
                    """.formatted(code),
                    true
            );
            mailSender.send(message);
            smtpKeepAliveService.recordEmailSent(); // reset the SMTP inactivity timer
        } catch (MessagingException | org.springframework.mail.MailException
                 | java.io.UnsupportedEncodingException e) {
            // MessagingException (checked, from MimeMessageHelper) and MailException (unchecked,
            // from JavaMailSender.send — e.g. SMTP unreachable) both mean "couldn't send". Surface
            // a clean 503 instead of letting MailException bubble up as a 500 + stack trace.
            log.warn("Verification email could not be sent to a user: {}", e.getMessage());
            throw new ServiceUnavailableException("Échec de l'envoi de l'email de vérification", e);
        }
    }
}
