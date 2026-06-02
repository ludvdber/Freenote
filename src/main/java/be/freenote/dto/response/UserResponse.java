package be.freenote.dto.response;

public record UserResponse(
        Long id,
        String username,
        String role,
        boolean verified,
        int xp,
        String bio,
        String website,
        String github,
        String linkedin,
        String discord,
        long documentCount,
        boolean profilePublic,
        boolean showInCarousel,
        boolean supporter,
        boolean termsAccepted,
        String avatarUrl,
        String avatarSource,
        String displayName,
        String firstName,
        String lastName,
        boolean displayRealName,
        Long sectionId,
        String sectionName,
        boolean usernameChosen,
        // Raw Discord CDN avatar URL — exposed only on the OWN profile (toResponse) so the avatar
        // picker can preview the "Photo Discord" option even when it is not the active source.
        // null on public/other-user responses (don't leak it when the user picked another avatar).
        String discordAvatarUrl
) {}
