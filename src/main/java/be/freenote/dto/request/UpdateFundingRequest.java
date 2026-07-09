package be.freenote.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;

import java.math.BigDecimal;

/** Coût mensuel du serveur affiché sur le thermomètre. Null = désactive la jauge. */
public record UpdateFundingRequest(
        @DecimalMin(value = "0.01", message = "Le coût doit être positif")
        @DecimalMax(value = "10000", message = "Coût irréaliste")
        @Digits(integer = 5, fraction = 2)
        BigDecimal monthlyCost
) {}
