package be.freenote.dto.response;

import java.math.BigDecimal;

/**
 * Thermomètre de financement du mois courant. {@code monthlyCost} null = fonctionnalité désactivée
 * (aucune jauge affichée) ; {@code monthTotal} = somme des dons Ko-fi rattachés à un compte depuis
 * le 1ᵉʳ du mois ; {@code donorCount} = donateurs distincts du mois (rattachés, montant &gt; 0).
 */
public record FundingResponse(BigDecimal monthlyCost, BigDecimal monthTotal, Long donorCount) {}
