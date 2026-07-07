package be.freenote.dto.request;

import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/** Mise à jour admin du compte à rebours de la home. {@code date} null = désactive la bannière. */
public record UpdateCountdownRequest(
        LocalDate date,
        @Size(max = 60) String label
) {}
