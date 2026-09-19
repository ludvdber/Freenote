package be.freenote.enums;

/**
 * Nature d'un signalement, choisie par l'étudiant qui signale (V19).
 *
 * <p>Le but n'est pas la taxonomie : c'est de rendre la file admin <strong>triable par problème</strong>.
 * Chaque valeur correspond à une action différente côté modération — une demande de suppression se
 * traite tout de suite, une suggestion d'amélioration peut attendre. L'ordre de déclaration est
 * l'ordre d'affichage dans le formulaire de signalement.
 */
public enum ReportType {
    /** Le document doit disparaître (droit d'auteur, données personnelles, publié par erreur). */
    SUPPRESSION,
    /** Contenu incomplet ou mal numérisé : pages manquantes, illisible, mal orienté. */
    AMELIORATION,
    /** Plus au programme / ancienne version du cours — encore lisible mais trompeur. */
    OBSOLETE,
    /** Erreur dans le contenu lui-même (réponse fausse, formule erronée). */
    ERREUR,
    /** Mauvais cours, mauvaise catégorie, mauvais professeur, mauvaise année : l'admin corrige les
     *  métadonnées sans toucher au fichier — le cas le plus fréquent et le plus vite réglé. */
    METADONNEES,
    /** Déjà en ligne ailleurs (doublon non détecté par le hash : re-scan, autre export PDF). */
    DOUBLON,
    /** Contenu inapproprié ou illégal. */
    INAPPROPRIE,
    /** Tout le reste — le message de l'étudiant fait foi. */
    AUTRE;

    /** Tolérant à l'entrée (casse, valeur inconnue d'un client plus ancien) : jamais d'exception,
     *  un signalement mal typé vaut mieux qu'un signalement perdu. */
    public static ReportType parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return AUTRE;
        }
        try {
            return valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return AUTRE;
        }
    }
}
