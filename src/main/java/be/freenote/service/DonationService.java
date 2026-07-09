package be.freenote.service;

import be.freenote.dto.response.DonationResponse;
import be.freenote.dto.response.FundingResponse;
import be.freenote.dto.response.PageResponse;
import org.springframework.data.domain.Pageable;

public interface DonationService {

    PageResponse<DonationResponse> listAll(Pageable pageable);

    /**
     * Grants `days` days of ad-free status to the given user. If the user already has an
     * active ad-free period, the new grant extends it; otherwise it starts now.
     * Records a synthetic Donation entry with amount=0 and a transaction id prefixed
     * "MANUAL-{adminUserId}-…" so the audit trail shows admin grants alongside Ko-fi donations.
     */
    DonationResponse grantAdFree(Long targetUserId, int days, Long actingAdminId);

    /**
     * Rattache un don Ko-fi orphelin (sans compte matché) à un utilisateur et lui applique les
     * avantages du montant (mêmes règles que le webhook). Refuse un don déjà rattaché.
     */
    DonationResponse attach(Long donationId, Long userId);

    /**
     * Supprime une ligne de don (audit + jauge du mois) — pensé pour purger les dons de TEST qui
     * polluent la liste et le thermomètre. Les avantages déjà appliqués au compte (sans-pub,
     * lifetime supporter, palettes) ne sont PAS repris : ils sont cumulatifs et irréversibles
     * proprement — l'admin peut toujours ajuster via grant manuel si besoin.
     */
    void delete(Long donationId);

    /** Thermomètre du mois courant — coût configuré (null = désactivé) + dons rattachés du mois. */
    FundingResponse getFunding();
}
