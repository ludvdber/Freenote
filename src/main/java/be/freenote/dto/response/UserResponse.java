package be.freenote.dto.response;

public record UserResponse(
        Long id,
        String username,
        String role,
        boolean verified,
        boolean trusted,
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
        String discordAvatarUrl,
        // Parcours à l'ISFCE (public si renseigné) : année d'arrivée, année de fin, diplômé.
        Integer studyStartYear,
        Integer studyEndYear,
        boolean graduated,
        // Palette d'accent (perk supporters) — own-profile only : résolue null quand l'entitlement
        // a expiré (le thème retombe sur le défaut sans effacer le choix en base).
        String accentPalette,
        boolean paletteEntitled,
        // Flag BRUT « palettes à vie » (don ≥ 5 € ou grant admin) — l'admin en a besoin pour son
        // toggle (paletteEntitled est dérivé, il peut venir d'un simple sans-pub actif). Scrubbed
        // (false) sur les réponses publiques comme trusted.
        boolean lifetimeSupporter,
        // Rôles staff V18 — PUBLICS par choix (chips de reconnaissance sur le profil, la seule
        // monnaie pour recruter des bénévoles), contrairement à role/trusted qui restent scrubbed.
        boolean moderator,
        boolean editor
) {}
