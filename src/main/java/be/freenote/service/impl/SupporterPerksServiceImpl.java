package be.freenote.service.impl;

import be.freenote.entity.User;
import be.freenote.entity.UserProfile;
import be.freenote.repository.UserOauthLinkRepository;
import be.freenote.service.DiscordRoleService;
import be.freenote.service.SupporterPerksService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class SupporterPerksServiceImpl implements SupporterPerksService {

    /** Seuil « gros don » : 1 mois/€ + palettes à vie + rôle Discord. En dessous : 1 mois tout court. */
    private static final BigDecimal SUPPORTER_THRESHOLD_EUR = BigDecimal.valueOf(5);
    private static final int DAYS_PER_MONTH = 30;
    /** 3 ans = la durée d'un bachelier classique — au-delà, offrir plus n'a pas de sens. */
    private static final int MAX_AD_FREE_MONTHS = 36;

    private final UserOauthLinkRepository oauthLinkRepository;
    private final DiscordRoleService discordRoleService;

    @Override
    @Transactional
    public LocalDateTime applyPerks(User user, BigDecimal amount) {
        UserProfile profile = user.getProfile();
        if (profile == null) {
            profile = UserProfile.builder().user(user).build();
            user.setProfile(profile);
        }

        LocalDateTime now = LocalDateTime.now();
        boolean supporterTier = amount.compareTo(SUPPORTER_THRESHOLD_EUR) >= 0;
        // intValue() = partie entière : 5,50 € => 5 mois (les centimes ne comptent pas).
        int months = supporterTier ? Math.min(amount.intValue(), MAX_AD_FREE_MONTHS) : 1;

        // Sans-pub cumulatif (même mécanique que le grant manuel admin), plafonné à 36 mois
        // dans le futur : un don de 100 € n'offre pas 100 mois.
        LocalDateTime base = profile.getAdFreeUntil() != null && profile.getAdFreeUntil().isAfter(now)
                ? profile.getAdFreeUntil()
                : now;
        LocalDateTime expiry = base.plusDays((long) months * DAYS_PER_MONTH);
        LocalDateTime cap = now.plusDays((long) MAX_AD_FREE_MONTHS * DAYS_PER_MONTH);
        if (expiry.isAfter(cap)) {
            expiry = cap;
        }
        profile.setAdFreeUntil(expiry);

        if (supporterTier) {
            profile.setLifetimeSupporter(true);
            pushSupporterRole(user.getId());
        } else {
            LocalDateTime paletteBase = profile.getPalettesUntil() != null && profile.getPalettesUntil().isAfter(now)
                    ? profile.getPalettesUntil()
                    : now;
            profile.setPalettesUntil(paletteBase.plusDays(DAYS_PER_MONTH));
        }

        log.info("Donation perks applied: user={}, amount={}, months={}, adFreeUntil={}, lifetime={}",
                user.getUsername(), amount, months, expiry, supporterTier);
        return expiry;
    }

    /** Fire-and-forget : le rôle Discord ne doit jamais faire échouer le traitement du don. */
    private void pushSupporterRole(Long userId) {
        oauthLinkRepository.findByUserId(userId).stream()
                .filter(link -> "DISCORD".equals(link.getProvider()))
                .findFirst()
                .ifPresent(link -> discordRoleService.assignSupporterRole(link.getOauthId()));
    }
}
