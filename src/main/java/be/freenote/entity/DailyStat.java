package be.freenote.entity;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.LocalDate;

/**
 * Compteur agrégé (jour, métrique, cible) — analytics du panel admin. Aucune donnée personnelle :
 * les écritures passent par l'upsert natif du repository (le buffer Redis est flushé par lots),
 * l'entité ne sert qu'aux lectures.
 */
@Entity
@Table(name = "daily_stats")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class DailyStat {

    @EmbeddedId
    private DailyStatId id;

    @Column(nullable = false)
    private long count;

    @Embeddable
    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class DailyStatId implements Serializable {
        private LocalDate day;

        @Column(length = 30)
        private String metric;

        /** '' quand la métrique n'a pas de cible (PK sans NULL). */
        @Column(length = 120)
        private String target;
    }
}
