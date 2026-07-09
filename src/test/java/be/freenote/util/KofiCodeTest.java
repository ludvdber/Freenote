package be.freenote.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class KofiCodeTest {

    private static final String SALT = "test-salt";

    @Test
    void codeRoundTrips() {
        String code = KofiCode.codeFor(42L, SALT);

        assertThat(code).matches("FN-16-[0-9A-Z]{2}"); // 42 en base 36 = "16"
        assertThat(KofiCode.findUserId(code, SALT)).contains(42L);
    }

    @Test
    void findsCodeEmbeddedInASentence() {
        String code = KofiCode.codeFor(1337L, SALT);

        assertThat(KofiCode.findUserId("Merci pour Freenote ! " + code + " — bonne continuation", SALT))
                .contains(1337L);
    }

    @Test
    void isCaseInsensitive() {
        String code = KofiCode.codeFor(42L, SALT);

        assertThat(KofiCode.findUserId(code.toLowerCase(), SALT)).contains(42L);
    }

    @Test
    void rejectsTamperedChecksum() {
        String code = KofiCode.codeFor(42L, SALT);
        // Change le dernier caractère du checksum (en évitant de retomber dessus).
        char last = code.charAt(code.length() - 1);
        String tampered = code.substring(0, code.length() - 1) + (last == 'A' ? 'B' : 'A');

        assertThat(KofiCode.findUserId(tampered, SALT)).isEmpty();
    }

    @Test
    void rejectsCodeGeneratedWithAnotherSalt() {
        String code = KofiCode.codeFor(42L, "other-salt");

        // Statistiquement les checksums peuvent coïncider (1/1296) — vérifie que CE couple diffère.
        if (!KofiCode.codeFor(42L, SALT).equals(code)) {
            assertThat(KofiCode.findUserId(code, SALT)).isEmpty();
        }
    }

    @Test
    void returnsEmptyOnGarbage() {
        assertThat(KofiCode.findUserId(null, SALT)).isEmpty();
        assertThat(KofiCode.findUserId("", SALT)).isEmpty();
        assertThat(KofiCode.findUserId("merci pour le site !", SALT)).isEmpty();
        assertThat(KofiCode.findUserId("FN-XX", SALT)).isEmpty();
    }

    @Test
    void skipsInvalidCodeButFindsAValidOneLater() {
        String valid = KofiCode.codeFor(7L, SALT);

        assertThat(KofiCode.findUserId("FN-99-ZZ puis " + valid, SALT)).contains(7L);
    }
}
