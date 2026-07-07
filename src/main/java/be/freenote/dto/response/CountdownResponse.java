package be.freenote.dto.response;

import java.time.LocalDate;

/** Compte à rebours de la home (rentrée, session d'examens…). {@code date} null = désactivé —
 *  le client masque aussi la bannière de lui-même une fois la date passée. */
public record CountdownResponse(LocalDate date, String label) {}
