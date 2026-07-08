package be.freenote.mapper;

import be.freenote.dto.response.LeaderboardEntry;
import be.freenote.dto.response.ProfileCardResponse;
import be.freenote.dto.response.UserResponse;
import be.freenote.entity.User;
import be.freenote.entity.UserProfile;
import be.freenote.enums.AvatarSource;
import org.mapstruct.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

@Mapper(componentModel = "spring")
public abstract class UserMapper {

    private static final String DICEBEAR_BASE = "https://api.dicebear.com/9.x/notionists/svg?seed=";

    public UserResponse toResponse(User user, long documentCount) {
        UserProfile p = user.getProfile();
        AvatarSource source = p != null && p.getAvatarSource() != null ? p.getAvatarSource() : AvatarSource.AUTO;
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getRole(),
                user.isVerified(),
                user.isTrusted(),
                user.getXp(),
                p != null ? p.getBio() : null,
                p != null ? p.getWebsite() : null,
                p != null ? p.getGithub() : null,
                p != null ? p.getLinkedin() : null,
                p != null ? p.getDiscord() : null,
                documentCount,
                p != null && p.isProfilePublic(),
                p != null && p.isShowInCarousel(),
                isSupporter(p),
                p != null && p.getTermsAcceptedAt() != null,
                resolveAvatarUrl(p, user.getUsername()),
                source.name(),
                resolveDisplayName(p, user.getUsername()),
                p != null ? p.getFirstName() : null,
                p != null ? p.getLastName() : null,
                p != null && p.isDisplayRealName(),
                p != null && p.getSection() != null ? p.getSection().getId() : null,
                p != null && p.getSection() != null ? p.getSection().getName() : null,
                user.isUsernameChosen(),
                p != null ? p.getDiscordAvatarUrl() : null,
                p != null ? p.getStudyStartYear() : null,
                p != null ? p.getStudyEndYear() : null,
                p != null && p.isGraduated()
        );
    }

    public UserResponse toPublicResponse(User user, long documentCount) {
        UserProfile p = user.getProfile();
        if (p != null && p.isProfilePublic()) {
            return scrubSensitive(toResponse(user, documentCount));
        }
        AvatarSource source = p != null && p.getAvatarSource() != null ? p.getAvatarSource() : AvatarSource.AUTO;
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                null,
                false,
                false,
                user.getXp(),
                null, null, null, null, null,
                documentCount,
                false,
                false,
                isSupporter(p),
                p != null && p.getTermsAcceptedAt() != null,
                resolveAvatarUrl(p, user.getUsername()),
                source.name(),
                resolveDisplayName(p, user.getUsername()),
                null,
                null,
                false,
                p != null && p.getSection() != null ? p.getSection().getId() : null,
                p != null && p.getSection() != null ? p.getSection().getName() : null,
                false,
                null,
                null,
                null,
                false
        );
    }

    /** Strips the fields another user has no business seeing, whatever the profile visibility:
     *  {@code role} and {@code trusted} are internal moderation state, and {@code discordAvatarUrl}
     *  embeds the user's Discord snowflake ID (de-anonymisation vector) — it is only ever exposed
     *  on the OWN profile ({@link #toResponse}) for the avatar picker preview. */
    private static UserResponse scrubSensitive(UserResponse r) {
        return new UserResponse(
                r.id(), r.username(), null, r.verified(), false, r.xp(),
                r.bio(), r.website(), r.github(), r.linkedin(), r.discord(),
                r.documentCount(), r.profilePublic(), r.showInCarousel(), r.supporter(),
                r.termsAccepted(), r.avatarUrl(), r.avatarSource(), r.displayName(),
                r.firstName(), r.lastName(), r.displayRealName(),
                r.sectionId(), r.sectionName(), r.usernameChosen(),
                null,
                r.studyStartYear(), r.studyEndYear(), r.graduated()
        );
    }

    public LeaderboardEntry toLeaderboardEntry(User user, int rank, long documentCount,
                                               boolean delegate, boolean formerDelegate) {
        UserProfile p = user.getProfile();
        return new LeaderboardEntry(
                user.getId(),
                rank,
                user.getUsername(),
                resolveDisplayName(p, user.getUsername()),
                user.getXp(),
                documentCount,
                isSupporter(p),
                resolveAvatarUrl(p, user.getUsername()),
                p != null && p.isGraduated(),
                p != null ? p.getStudyEndYear() : null,
                delegate,
                formerDelegate
        );
    }

    public ProfileCardResponse toProfileCard(User user) {
        UserProfile p = user.getProfile();
        return new ProfileCardResponse(
                user.getId(),
                user.getUsername(),
                resolveDisplayName(p, user.getUsername()),
                user.getRole(),
                p != null ? p.getDiscord() : null,
                p != null ? p.getGithub() : null,
                p != null ? p.getLinkedin() : null,
                isSupporter(p),
                resolveAvatarUrl(p, user.getUsername())
        );
    }

    /** Ad-free is a time-limited entitlement: derive it from the expiry timestamp, never from a
     *  stored boolean (which would never flip back off once a donation set it). */
    private static boolean isSupporter(UserProfile p) {
        return p != null && p.getAdFreeUntil() != null && p.getAdFreeUntil().isAfter(LocalDateTime.now());
    }

    public static String resolveDisplayName(UserProfile p, String username) {
        return resolveDisplayName(p != null && p.isDisplayRealName(),
                p == null ? null : p.getFirstName(), p == null ? null : p.getLastName(), username);
    }

    /** Variante « champs bruts » pour les projections JPQL (QuizListRow/DeckListRow) qui ne chargent
     *  pas l'entité UserProfile. Même logique que la variante entité — garder les deux synchronisées. */
    public static String resolveDisplayName(Boolean displayRealName, String firstName, String lastName, String username) {
        if (!Boolean.TRUE.equals(displayRealName)) return username;
        String first = firstName == null ? "" : firstName.trim();
        String last = lastName == null ? "" : lastName.trim();
        if (first.isEmpty() && last.isEmpty()) return username;
        String full = (first + " " + last).trim();
        return full.isEmpty() ? username : full;
    }

    /** Static : aussi utilisé par {@link DocumentMapper} pour l'avatar de l'uploader sur les cartes. */
    public static String resolveAvatarUrl(UserProfile p, String username) {
        if (p == null) return null;
        AvatarSource source = p.getAvatarSource() != null ? p.getAvatarSource() : AvatarSource.AUTO;
        return switch (source) {
            case LETTER, AUTO -> null;
            case DICEBEAR -> dicebearUrl(username);
            case DISCORD -> p.getDiscordAvatarUrl();
        };
    }

    private static String dicebearUrl(String username) {
        if (username == null || username.isBlank()) return null;
        return DICEBEAR_BASE + URLEncoder.encode(username, StandardCharsets.UTF_8);
    }
}
