package be.freenote.service;

import be.freenote.dto.response.ActivityLogResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.enums.ActivityType;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;

public interface ActivityLogService {

    /** Records an event. Never throws — a logging failure must not break the action it records. */
    void log(ActivityType type, Long actorId, String actorName, String message);

    /** Décision du staff : l'auteur est l'utilisateur de la requête en cours (jamais un « Admin » anonyme). */
    void logStaff(ActivityType type, String message);

    /**
     * {@code type} : un type exact, ou une famille terminée par « * » (« EMAIL_* »). {@code text} :
     * sous-chaîne du pseudo de l'acteur ou du message. Vides = pas de filtre.
     */
    PageResponse<ActivityLogResponse> list(String type, String text, Pageable pageable);

    /**
     * Supprime les entrées antérieures à {@code before}, SAUF les décisions du staff : elles suivent
     * leur propre durée (1 an) et une purge manuelle ne doit pas pouvoir effacer une trace.
     */
    int purgeBefore(LocalDateTime before);
}
