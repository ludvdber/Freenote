package be.freenote.dto.response;

/**
 * Statut public minimal d'un document pour un visiteur anonyme : « existe mais réservé » (titre seul,
 * aucune autre métadonnée) ou inconnu. Permet à un lien partagé vers un doc hors catégories publiques
 * d'afficher « réservé aux étudiants ISFCE — connecte-toi » au lieu d'un faux « introuvable ».
 * Seuls les documents VÉRIFIÉS exposent leur titre — un doc non relu n'existe pas publiquement.
 *
 * `publiclyVisible` dit si le teaser complet (/api/public/documents/{id}) répondra : le frontend
 * interroge ce statut EN PREMIER et ne tente le teaser que s'il est visible — sinon chaque doc
 * réservé loguait un 404 en console (le navigateur trace toute requête en échec).
 */
public record PublicDocumentStatus(boolean exists, String title, boolean publiclyVisible) {

    public static PublicDocumentStatus visible(String title) {
        return new PublicDocumentStatus(true, title, true);
    }

    public static PublicDocumentStatus reserved(String title) {
        return new PublicDocumentStatus(true, title, false);
    }

    public static PublicDocumentStatus unknown() {
        return new PublicDocumentStatus(false, null, false);
    }
}
