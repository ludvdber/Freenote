package be.freenote.service;

import be.freenote.dto.response.CountdownResponse;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Réglages du site (table clé-valeur `app_settings`, éditée via l'admin). */
public interface SettingsService {
    /** Compte à rebours de la home — date/label null quand non configuré. */
    CountdownResponse getCountdown();

    /** {@code date} null = désactive (les deux clés sont effacées). */
    void setCountdown(LocalDate date, String label);

    /** Coût mensuel du serveur (thermomètre de financement) — null quand non configuré. */
    BigDecimal getFundingCost();

    /** {@code cost} null = désactive la jauge. */
    void setFundingCost(BigDecimal cost);
}
