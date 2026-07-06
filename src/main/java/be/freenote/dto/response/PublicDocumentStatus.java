package be.freenote.dto.response;

/**
 * Statut public minimal d'un document pour un visiteur anonyme : « existe mais réservé » (titre seul,
 * aucune autre métadonnée) ou inconnu. Permet à un lien partagé vers un doc hors catégories publiques
 * d'afficher « réservé aux étudiants ISFCE — connecte-toi » au lieu d'un faux « introuvable ».
 * Seuls les documents VÉRIFIÉS exposent leur titre — un doc non relu n'existe pas publiquement.
 */
public record PublicDocumentStatus(boolean exists, String title) {

    public static PublicDocumentStatus reserved(String title) {
        return new PublicDocumentStatus(true, title);
    }

    public static PublicDocumentStatus unknown() {
        return new PublicDocumentStatus(false, null);
    }
}
