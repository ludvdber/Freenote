package be.freenote.service;

import be.freenote.entity.User;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Règles des avantages liés à un don (source unique — utilisées par le webhook Ko-fi ET le
 * rattachement manuel admin) :
 * <ul>
 *   <li>Don &lt; 5 € : 1 mois sans pub + palettes d'accent pendant 1 mois (cumulatif).</li>
 *   <li>Don ≥ 5 € : 1 mois sans pub PAR euro (partie entière), palettes illimitées à vie
 *       ({@code lifetime_supporter}) + rôle Discord « Supporter ».</li>
 *   <li>Le sans-pub total est plafonné à 36 mois dans le futur (3 ans = un bachelier complet).</li>
 * </ul>
 */
public interface SupporterPerksService {

    /**
     * Applique les avantages du don au compte (le profil est modifié en place — l'appelant doit
     * être transactionnel). Retourne la nouvelle échéance sans-pub, pour l'audit du don.
     */
    LocalDateTime applyPerks(User user, BigDecimal amount);
}
