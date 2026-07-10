package be.freenote.service;

import be.freenote.dto.request.PublishDeckRequest;
import be.freenote.dto.response.FlashcardDeckResponse;
import be.freenote.dto.response.FlashcardDeckSummary;
import be.freenote.dto.response.PageResponse;
import org.springframework.data.domain.Pageable;

public interface FlashcardDeckService {

    /** Enregistre un paquet sur le compte (privé) ou le publie, selon {@code published}. */
    FlashcardDeckResponse save(Long userId, PublishDeckRequest request);

    /** Met à jour un paquet possédé (titre, cartes, cours, statut publié). Admin : modération. */
    FlashcardDeckResponse update(Long userId, boolean isAdmin, Long id, PublishDeckRequest request);

    /** Bibliothèque : paquets publiés uniquement. {@code callerId} (nullable — accès anonyme) sert
     *  à marquer {@code owned} ; {@code ownerId} filtre les paquets publiés d'un utilisateur (profil). */
    PageResponse<FlashcardDeckSummary> list(Long courseId, Long sectionId, Long ownerId, Pageable pageable, Long callerId);

    /** « Mes paquets » : tous les paquets du compte (privés + publiés), dernier modifié d'abord. */
    PageResponse<FlashcardDeckSummary> mine(Long userId, Pageable pageable);

    /** Paquet complet (cartes incluses) — un paquet privé n'est visible que de son propriétaire/admin. */
    FlashcardDeckResponse get(Long id, Long callerId, boolean isAdmin);

    /** Delete a deck — allowed for its owner or an admin (moderation). */
    void delete(Long userId, boolean isAdmin, Long id);

    /** Modération (admin/modérateur) : retire un paquet de la bibliothèque publique SANS le détruire —
     *  il redevient un enregistrement privé de son auteur, qui est notifié. Idempotent. */
    void unpublish(Long id);
}
