package be.freenote.dto.response;

public record ProfileCardResponse(
        /** Pour le lien « Voir le profil » du popup carrousel (/users/{id}) — 2026-07-08. */
        Long id,
        String username,
        String displayName,
        String role,
        String discord,
        String github,
        String linkedin,
        boolean supporter,
        String avatarUrl
) {}
