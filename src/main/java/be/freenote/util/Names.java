package be.freenote.util;

import java.text.Collator;
import java.util.Comparator;
import java.util.Locale;

/**
 * Tri alphabétique des noms affichés (sections, cours, professeurs) <b>indépendant de la collation
 * de la base</b>.
 *
 * <p>Pourquoi ne pas se contenter d'un {@code ORDER BY name} : les images {@code postgres:*-alpine}
 * reposent sur musl, qui ne fournit aucune locale — la base tourne donc en collation <b>C</b>, où
 * l'ordre est celui des octets UTF-8. « Économie » commence par 0xC3, supérieur à n'importe quelle
 * lettre ASCII : toutes les initiales accentuées se retrouvaient <b>après le Z</b> dans les listes
 * déroulantes. Changer la collation demanderait de recréer la base ; un {@code Collator} français
 * règle le problème ici, sur des listes de référence qui tiennent en quelques centaines de lignes.
 *
 * <p>Force {@code SECONDARY} : les accents comptent pour départager deux noms par ailleurs
 * identiques, mais la casse non — « économie » et « Économie » restent voisins.
 */
public final class Names {

    private Names() {
    }

    private static Collator collator() {
        // Collator n'est pas thread-safe : une instance par appel (le coût est négligeable face à
        // la requête SQL qui précède).
        Collator collator = Collator.getInstance(Locale.FRENCH);
        collator.setStrength(Collator.SECONDARY);
        return collator;
    }

    /** Comparateur alphabétique français, tolérant au nom nul (placé en fin de liste). */
    public static Comparator<String> alphabetical() {
        Collator collator = collator();
        return Comparator.nullsLast(collator::compare);
    }

    /** Variante pour trier des objets sur l'un de leurs champs texte. */
    public static <T> Comparator<T> byName(java.util.function.Function<T, String> name) {
        return Comparator.comparing(name, alphabetical());
    }
}
