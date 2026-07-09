package be.freenote.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Événement d'usage anonyme (visite/outil/guide/profil) — whitelist stricte côté service. */
public record TrackRequest(
        @NotBlank @Size(max = 30) String metric,
        @NotBlank @Size(max = 120) String target
) {}
