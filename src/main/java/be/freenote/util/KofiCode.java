package be.freenote.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Code personnel de don Ko-fi : « FN-{id en base 36}-{checksum} », que l'utilisateur colle dans le
 * message de son don pour rattacher le paiement à son compte Freenote (les étudiants ne mettent ni
 * leur email d'école ni leur pseudo exact sur Ko-fi — le code est le seul matching fiable).
 *
 * <p>Le checksum (2 caractères, dérivés de SHA-256(salt:id)) évite qu'une faute de frappe crédite
 * les avantages au mauvais compte. Le salt réutilise {@code app.email.hash-salt} (déjà secret,
 * déjà injecté dans le service Ko-fi) — un tiers ne peut pas forger le code d'un autre id.
 */
public final class KofiCode {

    /** Base 36 en MAJUSCULES : ids courts, lisibles, sans ambiguïté d'URL. */
    private static final Pattern CODE_PATTERN =
            Pattern.compile("FN-([0-9A-Z]{1,12})-([0-9A-Z]{2})", Pattern.CASE_INSENSITIVE);

    private KofiCode() {
    }

    public static String codeFor(long userId, String salt) {
        String id36 = Long.toString(userId, 36).toUpperCase();
        return "FN-" + id36 + "-" + checksum(userId, salt);
    }

    /**
     * Cherche un code valide n'importe où dans le texte (le message Ko-fi peut contenir autre
     * chose autour). Retourne l'id utilisateur du premier code dont le checksum est correct.
     */
    public static Optional<Long> findUserId(String text, String salt) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }
        Matcher m = CODE_PATTERN.matcher(text);
        while (m.find()) {
            long userId;
            try {
                userId = Long.parseLong(m.group(1).toLowerCase(), 36);
            } catch (NumberFormatException e) {
                continue;
            }
            if (userId > 0 && m.group(2).toUpperCase().equals(checksum(userId, salt))) {
                return Optional.of(userId);
            }
        }
        return Optional.empty();
    }

    private static String checksum(long userId, String salt) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest((salt + ":" + userId).getBytes(StandardCharsets.UTF_8));
            // 2 caractères base 36 depuis les 2 premiers octets (non signés) — 1296 combinaisons,
            // largement assez pour attraper une faute de frappe.
            int v = ((hash[0] & 0xFF) << 8 | (hash[1] & 0xFF)) % (36 * 36);
            char c1 = Character.toUpperCase(Character.forDigit(v / 36, 36));
            char c2 = Character.toUpperCase(Character.forDigit(v % 36, 36));
            return "" + c1 + c2;
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
