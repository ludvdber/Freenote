package be.freenote.service;

import be.freenote.dto.response.AdminAttentionResponse;
import be.freenote.dto.response.AdminAttentionResponse.StuckAccount;
import be.freenote.entity.ActivityLog;
import be.freenote.entity.User;
import be.freenote.entity.UserOauthLink;
import be.freenote.enums.ActivityType;
import be.freenote.exception.DuplicateResourceException;
import be.freenote.repository.ActivityLogRepository;
import be.freenote.repository.Repositories;
import be.freenote.repository.UserOauthLinkRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.DiscordRoleService.DmResult;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Vue d'ensemble « à surveiller » + relance des inscriptions bloquées. Un compte non vérifié n'a
 * AUCUNE adresse stockée (seul le hash l'est, et seulement après vérification) : la relance passe
 * donc par un message privé du bot Discord, le seul canal qu'on ait vers lui.
 */
@Service
@RequiredArgsConstructor
public class AdminAttentionService {

    /** Avant 48 h, l'étudiant est peut-être encore en train de s'inscrire ; après 30 j, le compte est abandonné. */
    private static final Duration STUCK_AFTER = Duration.ofHours(48);
    private static final Duration STUCK_UNTIL = Duration.ofDays(30);
    private static final Duration REMINDER_COOLDOWN = Duration.ofHours(24);
    private static final String REMINDER_KEY = "onboarding-reminder:";

    private final SmtpKeepAliveService smtpKeepAliveService;
    private final SystemAlertService systemAlertService;
    private final UserRepository userRepository;
    private final UserOauthLinkRepository oauthLinkRepository;
    private final ActivityLogRepository activityLogRepository;
    private final ActivityLogService activityLogService;
    private final DiscordRoleService discordRoleService;
    private final StringRedisTemplate redisTemplate;

    @Value("${app.frontend.url:https://freenote.be}")
    private String frontendUrl;

    @Transactional(readOnly = true)
    public AdminAttentionResponse getAttention() {
        LocalDateTime now = LocalDateTime.now();
        List<User> stuck = userRepository.findTop30ByVerifiedFalseAndCreatedAtBetweenOrderByCreatedAtDesc(
                now.minus(STUCK_UNTIL), now.minus(STUCK_AFTER));

        Map<Long, ActivityLog> lastEmail = new HashMap<>();
        if (!stuck.isEmpty()) {
            // Trié du plus récent au plus ancien : le premier vu par compte est son dernier événement.
            activityLogRepository.findEmailEventsOf(stuck.stream().map(User::getId).toList())
                    .forEach(a -> lastEmail.putIfAbsent(a.getActorId(), a));
        }
        List<StuckAccount> accounts = stuck.stream().map(u -> {
            ActivityLog e = lastEmail.get(u.getId());
            return new StuckAccount(u.getId(), u.getUsername(), u.isUsernameChosen(), u.getCreatedAt(),
                    e == null ? null : e.getType(), e == null ? null : e.getMessage(),
                    e == null ? null : e.getCreatedAt(), reminded(u.getId()));
        }).toList();

        return new AdminAttentionResponse(smtpKeepAliveService.getStatus(),
                systemAlertService.unacknowledgedCount(), accounts);
    }

    /**
     * Envoie la relance et renvoie le résultat Discord. Une relance par compte et par 24 h : un double
     * clic ne doit pas spammer l'étudiant (409). Un échec libère le créneau pour pouvoir réessayer.
     */
    public DmResult remindOnboarding(Long userId) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        if (user.isVerified()) {
            throw new IllegalArgumentException("Ce compte est déjà vérifié");
        }
        String key = REMINDER_KEY + userId;
        if (!Boolean.TRUE.equals(redisTemplate.opsForValue().setIfAbsent(key, "1", REMINDER_COOLDOWN))) {
            throw new DuplicateResourceException("Ce compte a déjà été relancé dans les dernières 24 h");
        }
        String discordId = oauthLinkRepository.findByUserId(userId).stream()
                .filter(l -> "DISCORD".equalsIgnoreCase(l.getProvider()))
                .map(UserOauthLink::getOauthId).findFirst().orElse(null);

        DmResult result = discordRoleService.sendDirectMessage(discordId, reminderText(user));
        if (result == DmResult.SENT) {
            activityLogService.logStaff(ActivityType.STAFF_ACTION,
                    "Relance d'inscription envoyée sur Discord à " + user.getUsername());
        } else {
            redisTemplate.delete(key);
        }
        return result;
    }

    private boolean reminded(Long userId) {
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(REMINDER_KEY + userId));
        } catch (Exception e) {
            return false;
        }
    }

    private String reminderText(User user) {
        String step = user.isUsernameChosen()
                ? "il ne te reste qu'à vérifier ton adresse @isfce.be"
                : "il te reste à choisir ton pseudo, puis à vérifier ton adresse @isfce.be";
        return "Salut ! Tu as commencé ton inscription sur Freenote, mais ton compte n'est pas encore activé : "
                + step + ".\n\nReconnecte-toi sur " + frontendUrl + " , entre ton adresse et le code reçu par mail.\n"
                + "Le mail n'arrive pas ? Regarde dans le courrier indésirable, puis redemande un code depuis le site.\n\n"
                + "— L'équipe Freenote";
    }
}
