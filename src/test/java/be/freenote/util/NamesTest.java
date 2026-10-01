package be.freenote.util;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tri des noms de référence. Le cas qui a motivé ce comparateur : les images
 * {@code postgres:*-alpine} tournent en collation <b>C</b> (musl n'embarque aucune locale), donc un
 * {@code ORDER BY name} classait « Économie » <i>après</i> « Zoologie » — en octets UTF-8, É (0xC3…)
 * dépasse toute lettre ASCII. Toutes les initiales accentuées tombaient en fin de liste déroulante.
 */
class NamesTest {

    private static List<String> sorted(String... names) {
        List<String> list = new ArrayList<>(List.of(names));
        list.sort(Names.alphabetical());
        return list;
    }

    @Test
    void classeLesInitialesAccentueesAvecLeurLettreDeBase() {
        assertThat(sorted("Zoologie", "Économie", "Anglais", "Électronique", "Droit"))
                .containsExactly("Anglais", "Droit", "Économie", "Électronique", "Zoologie");
    }

    @Test
    void placeLesAccentsALInterieurDuMotAuBonEndroit() {
        assertThat(sorted("Mathématiques", "Marketing", "Méthodologie"))
                .containsExactly("Marketing", "Mathématiques", "Méthodologie");
    }

    /** Force SECONDARY : la casse ne départage pas, deux variantes restent voisines. */
    @Test
    void ignoreLaCasse() {
        assertThat(sorted("bureautique", "Anglais", "Comptabilité"))
                .containsExactly("Anglais", "bureautique", "Comptabilité");
    }

    @Test
    void toleranceAuNomNulEnFinDeListe() {
        List<String> list = new ArrayList<>(List.of("Droit", "Anglais"));
        list.add(null);
        list.sort(Names.alphabetical());

        assertThat(list).containsExactly("Anglais", "Droit", null);
    }

    @Test
    void trieDesObjetsSurLeurChampNom() {
        record Section(String name) { }
        List<Section> list = new ArrayList<>(List.of(
                new Section("Zoologie"), new Section("Économie"), new Section("Anglais")));

        list.sort(Names.byName(Section::name));

        assertThat(list).extracting(Section::name).containsExactly("Anglais", "Économie", "Zoologie");
    }
}
