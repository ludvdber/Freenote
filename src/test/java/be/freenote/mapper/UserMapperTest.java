package be.freenote.mapper;

import be.freenote.dto.response.LeaderboardEntry;
import be.freenote.dto.response.ProfileCardResponse;
import be.freenote.dto.response.UserResponse;
import be.freenote.entity.Section;
import be.freenote.entity.User;
import be.freenote.entity.UserProfile;
import be.freenote.enums.AvatarSource;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link UserMapper} est entièrement pur (aucun accès base — c'est la règle anti-N+1 du projet),
 * donc testable directement. Ce qu'on vérifie ici n'est pas de la plomberie de recopie de champs
 * mais **trois garanties de confidentialité** dont rien ne protégeait la régression :
 * le scrubbing d'un profil public, le masquage d'un profil privé, et le fait que
 * {@code discordAvatarUrl} — qui contient l'identifiant Discord, donc un vecteur de
 * dé-anonymisation — ne sorte JAMAIS d'une réponse destinée à quelqu'un d'autre.
 */
class UserMapperTest {

    private final UserMapper mapper = new UserMapperImpl();

    private static Section section(long id, String name) {
        return Section.builder().id(id).name(name).build();
    }

    private static User user() {
        return User.builder()
                .id(7L).username("Sophie_M").role("ADMIN")
                .verified(true).trusted(true).xp(280)
                .usernameChosen(true).moderator(true).editor(true)
                .build();
    }

    private static UserProfile.UserProfileBuilder profile() {
        return UserProfile.builder()
                .bio("Bio").website("https://ex.be").github("gh").linkedin("li").discord("Sophie#1")
                .discordAvatarUrl("https://cdn.discordapp.com/avatars/123456789/abc.png")
                .avatarSource(AvatarSource.DISCORD)
                .firstName("Sophie").lastName("Martin").displayRealName(true)
                .section(section(3L, "Informatique"))
                .studyStartYear(2023).studyEndYear(2026)
                .termsAcceptedAt(LocalDateTime.now());
    }

    @Nested
    class ProprePropreProfil {

        @Test
        void exposeToutSurSonPropreProfil() {
            User u = user();
            u.setProfile(profile().profilePublic(true).build());

            UserResponse r = mapper.toResponse(u, 12);

            assertThat(r.role()).isEqualTo("ADMIN");
            assertThat(r.trusted()).isTrue();
            assertThat(r.bio()).isEqualTo("Bio");
            assertThat(r.documentCount()).isEqualTo(12);
            assertThat(r.sectionId()).isEqualTo(3L);
            assertThat(r.sectionName()).isEqualTo("Informatique");
            // Seul endroit où l'URL Discord brute a le droit de sortir : l'aperçu du sélecteur
            // d'avatar sur SA propre page de profil.
            assertThat(r.discordAvatarUrl()).contains("cdn.discordapp.com");
        }

        @Test
        void toleUnProfilAbsent() {
            User u = user();
            u.setProfile(null);

            UserResponse r = mapper.toResponse(u, 0);

            assertThat(r.bio()).isNull();
            assertThat(r.avatarSource()).isEqualTo("AUTO");
            assertThat(r.displayName()).isEqualTo("Sophie_M");
            assertThat(r.profilePublic()).isFalse();
            assertThat(r.paletteEntitled()).isFalse();
        }
    }

    @Nested
    class ReponsePublique {

        @Test
        void masqueLEtatDeModerationSurUnProfilPUBLIC() {
            User u = user();
            u.setProfile(profile().profilePublic(true).build());

            UserResponse r = mapper.toPublicResponse(u, 12);

            // Le profil est public : la bio et les liens sortent…
            assertThat(r.bio()).isEqualTo("Bio");
            assertThat(r.github()).isEqualTo("gh");
            // …mais jamais l'état interne de modération ni l'identifiant Discord.
            assertThat(r.role()).isNull();
            assertThat(r.trusted()).isFalse();
            assertThat(r.discordAvatarUrl()).isNull();
            assertThat(r.accentPalette()).isNull();
            assertThat(r.lifetimeSupporter()).isFalse();
        }

        @Test
        void masqueLesChampsPersonnelsSurUnProfilPRIVE() {
            User u = user();
            u.setProfile(profile().profilePublic(false).build());

            UserResponse r = mapper.toPublicResponse(u, 12);

            assertThat(r.bio()).isNull();
            assertThat(r.website()).isNull();
            assertThat(r.github()).isNull();
            assertThat(r.linkedin()).isNull();
            assertThat(r.discord()).isNull();
            assertThat(r.firstName()).isNull();
            assertThat(r.lastName()).isNull();
            assertThat(r.discordAvatarUrl()).isNull();
            // Ce qui reste visible malgré tout : le comportement voulu (« comme GitHub »).
            assertThat(r.xp()).isEqualTo(280);
            assertThat(r.documentCount()).isEqualTo(12);
            assertThat(r.sectionName()).isEqualTo("Informatique");
        }

        /** V18 : les chips staff sont une reconnaissance publique assumée, même profil privé. */
        @Test
        void gardeLesRolesStaffVisiblesDansLesDeuxCas() {
            User pub = user();
            pub.setProfile(profile().profilePublic(true).build());
            User priv = user();
            priv.setProfile(profile().profilePublic(false).build());

            assertThat(mapper.toPublicResponse(pub, 0).moderator()).isTrue();
            assertThat(mapper.toPublicResponse(pub, 0).editor()).isTrue();
            assertThat(mapper.toPublicResponse(priv, 0).moderator()).isTrue();
            assertThat(mapper.toPublicResponse(priv, 0).editor()).isTrue();
        }
    }

    @Nested
    class StatutSupporter {

        /** Dérivé de la date d'expiration, jamais d'un booléen stocké — sinon il ne retomberait
         *  plus jamais à faux une fois un don encaissé. */
        @Test
        void estSupporterTantQueLeSansPubCourt() {
            User u = user();
            u.setProfile(profile().adFreeUntil(LocalDateTime.now().plusDays(10)).build());
            assertThat(mapper.toResponse(u, 0).supporter()).isTrue();

            u.setProfile(profile().adFreeUntil(LocalDateTime.now().minusDays(1)).build());
            assertThat(mapper.toResponse(u, 0).supporter()).isFalse();
        }

        @Test
        void palettesAccordeesAVieParPalettesUntilOuParLeSansPub() {
            assertThat(UserMapper.isPaletteEntitled(null)).isFalse();
            assertThat(UserMapper.isPaletteEntitled(UserProfile.builder().build())).isFalse();
            assertThat(UserMapper.isPaletteEntitled(
                    UserProfile.builder().lifetimeSupporter(true).build())).isTrue();
            assertThat(UserMapper.isPaletteEntitled(
                    UserProfile.builder().palettesUntil(LocalDateTime.now().plusDays(1)).build())).isTrue();
            // Règle produit 2026-07-09 : des jours sans pub actifs donnent aussi les couleurs.
            assertThat(UserMapper.isPaletteEntitled(
                    UserProfile.builder().adFreeUntil(LocalDateTime.now().plusDays(1)).build())).isTrue();
            assertThat(UserMapper.isPaletteEntitled(
                    UserProfile.builder().palettesUntil(LocalDateTime.now().minusDays(1)).build())).isFalse();
        }

        /** L'entitlement expiré retourne null SANS effacer le choix en base : le thème retombe
         *  sur le défaut, et la palette revient telle quelle si l'utilisateur redonne. */
        @Test
        void laPaletteDisparaitDeLaReponseQuandLEntitlementExpire() {
            User u = user();
            u.setProfile(profile().accentPalette("nebula")
                    .palettesUntil(LocalDateTime.now().minusDays(1)).build());

            UserResponse r = mapper.toResponse(u, 0);

            assertThat(r.accentPalette()).isNull();
            assertThat(r.paletteEntitled()).isFalse();
        }
    }

    @Nested
    class NomAffiche {

        @Test
        void retombeSurLePseudoQuandLOptionEstDesactivee() {
            assertThat(UserMapper.resolveDisplayName(false, "Sophie", "Martin", "Sophie_M"))
                    .isEqualTo("Sophie_M");
        }

        @Test
        void retombeSurLePseudoQuandLesDeuxNomsSontVides() {
            assertThat(UserMapper.resolveDisplayName(true, "  ", null, "Sophie_M")).isEqualTo("Sophie_M");
            assertThat(UserMapper.resolveDisplayName(null, null, null, "Sophie_M")).isEqualTo("Sophie_M");
        }

        @Test
        void accepteUnSeulDesDeuxNoms() {
            assertThat(UserMapper.resolveDisplayName(true, "Sophie", null, "Sophie_M")).isEqualTo("Sophie");
            assertThat(UserMapper.resolveDisplayName(true, null, "Martin", "Sophie_M")).isEqualTo("Martin");
        }

        @Test
        void assembleEtNettoieLesEspaces() {
            assertThat(UserMapper.resolveDisplayName(true, " Sophie ", " Martin ", "Sophie_M"))
                    .isEqualTo("Sophie Martin");
        }

        /** Les deux variantes (entité et champs bruts des projections JPQL) doivent rester alignées. */
        @Test
        void lesDeuxVariantesDonnentLeMemeResultat() {
            UserProfile p = UserProfile.builder()
                    .displayRealName(true).firstName("Sophie").lastName("Martin").build();
            assertThat(UserMapper.resolveDisplayName(p, "Sophie_M"))
                    .isEqualTo(UserMapper.resolveDisplayName(true, "Sophie", "Martin", "Sophie_M"))
                    .isEqualTo("Sophie Martin");
            assertThat(UserMapper.resolveDisplayName((UserProfile) null, "Sophie_M")).isEqualTo("Sophie_M");
        }
    }

    @Nested
    class Avatar {

        @Test
        void lettreEtAutoNeRenvoientAucuneUrl() {
            assertThat(UserMapper.resolveAvatarUrl(
                    UserProfile.builder().avatarSource(AvatarSource.LETTER).build(), "Sophie_M")).isNull();
            assertThat(UserMapper.resolveAvatarUrl(
                    UserProfile.builder().avatarSource(AvatarSource.AUTO).build(), "Sophie_M")).isNull();
            assertThat(UserMapper.resolveAvatarUrl(null, "Sophie_M")).isNull();
        }

        @Test
        void dicebearEncodeLePseudoDansLUrl() {
            String url = UserMapper.resolveAvatarUrl(
                    UserProfile.builder().avatarSource(AvatarSource.DICEBEAR).build(), "Jean Luc+");

            assertThat(url).startsWith("https://api.dicebear.com/9.x/notionists/svg?seed=");
            // Le pseudo est encodé : sans ça un espace ou un « + » casserait l'URL de la graine.
            assertThat(url).doesNotContain(" ");
            assertThat(url).endsWith("Jean+Luc%2B");
        }

        @Test
        void dicebearSansPseudoNeFabriquePasDUrlBancale() {
            UserProfile p = UserProfile.builder().avatarSource(AvatarSource.DICEBEAR).build();
            assertThat(UserMapper.resolveAvatarUrl(p, null)).isNull();
            assertThat(UserMapper.resolveAvatarUrl(p, "   ")).isNull();
        }

        @Test
        void discordRenvoieLUrlCapturee() {
            assertThat(UserMapper.resolveAvatarUrl(profile().build(), "Sophie_M"))
                    .isEqualTo("https://cdn.discordapp.com/avatars/123456789/abc.png");
        }
    }

    @Nested
    class AutresVues {

        @Test
        void entreeDeClassement() {
            User u = user();
            u.setProfile(profile().graduated(true).build());

            LeaderboardEntry e = mapper.toLeaderboardEntry(u, 4, 12, true, false);

            assertThat(e.rank()).isEqualTo(4);
            assertThat(e.username()).isEqualTo("Sophie_M");
            assertThat(e.displayName()).isEqualTo("Sophie Martin");
            assertThat(e.xp()).isEqualTo(280);
            assertThat(e.documentCount()).isEqualTo(12);
            assertThat(e.delegate()).isTrue();
            assertThat(e.formerDelegate()).isFalse();
            assertThat(e.graduated()).isTrue();
            assertThat(e.studyEndYear()).isEqualTo(2026);
        }

        @Test
        void carteDeProfilDuCarrousel() {
            User u = user();
            u.setProfile(profile().build());

            ProfileCardResponse c = mapper.toProfileCard(u);

            assertThat(c.id()).isEqualTo(7L);
            assertThat(c.username()).isEqualTo("Sophie_M");
            assertThat(c.displayName()).isEqualTo("Sophie Martin");
            assertThat(c.github()).isEqualTo("gh");
            assertThat(c.avatarUrl()).contains("cdn.discordapp.com");
        }

        @Test
        void carteDeProfilSansProfil() {
            User u = user();
            u.setProfile(null);

            ProfileCardResponse c = mapper.toProfileCard(u);

            assertThat(c.displayName()).isEqualTo("Sophie_M");
            assertThat(c.avatarUrl()).isNull();
            assertThat(c.supporter()).isFalse();
        }
    }
}
