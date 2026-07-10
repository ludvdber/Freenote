package be.freenote.service;

import be.freenote.dto.request.CreateGuideRequest;
import be.freenote.dto.response.GuideResponse;
import be.freenote.entity.Guide;
import be.freenote.entity.User;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.repository.GuideRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.impl.GuideServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GuideServiceImplTest {

    @Mock GuideRepository guideRepository;
    @Mock UserRepository userRepository;
    @InjectMocks GuideServiceImpl service;

    private User admin() {
        User u = new User();
        u.setId(1L);
        u.setUsername("admin");
        return u;
    }

    private CreateGuideRequest req(String title, boolean published) {
        return new CreateGuideRequest(title, "Résumé", "# Contenu\n`x << 2`", "Java", "convertisseur-bases", published, false);
    }

    @Test
    void create_derives_an_accent_stripped_slug_and_snapshots_the_author() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin()));
        when(guideRepository.existsBySlug(anyString())).thenReturn(false);
        when(guideRepository.save(any(Guide.class))).thenAnswer(i -> i.getArgument(0));

        GuideResponse res = service.create(1L, req("Décalage binaire en Java !", true));

        assertThat(res.slug()).isEqualTo("decalage-binaire-en-java");
        assertThat(res.authorName()).isEqualTo("admin");
        assertThat(res.published()).isTrue();
        assertThat(res.relatedTool()).isEqualTo("convertisseur-bases");
    }

    @Test
    void create_suffixes_the_slug_on_collision() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin()));
        when(guideRepository.existsBySlug("java")).thenReturn(true);
        when(guideRepository.existsBySlug("java-2")).thenReturn(false);
        when(guideRepository.save(any(Guide.class))).thenAnswer(i -> i.getArgument(0));

        GuideResponse res = service.create(1L, req("Java", false));

        assertThat(res.slug()).isEqualTo("java-2");
    }

    @Test
    void getPublishedBySlug_hides_drafts() {
        Guide draft = Guide.builder().slug("brouillon").title("T").content("c").published(false).authorName("admin").build();
        when(guideRepository.findBySlug("brouillon")).thenReturn(Optional.of(draft));

        assertThatThrownBy(() -> service.getPublishedBySlug("brouillon", true))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void membersOnly_guide_strips_content_for_an_unverified_caller_but_not_for_a_verified_one() {
        Guide locked = Guide.builder().slug("interne").title("Guide interne").content("# Secret de cours")
                .published(true).membersOnly(true).authorName("admin").build();
        when(guideRepository.findBySlug("interne")).thenReturn(Optional.of(locked));

        GuideResponse anonymous = service.getPublishedBySlug("interne", false);
        assertThat(anonymous.content()).isNull();          // le Markdown ne sort pas du serveur
        assertThat(anonymous.membersOnly()).isTrue();
        assertThat(anonymous.title()).isEqualTo("Guide interne"); // métadonnées conservées (panneau verrou)

        GuideResponse verified = service.getPublishedBySlug("interne", true);
        assertThat(verified.content()).isEqualTo("# Secret de cours");
    }

    @Test
    void update_keeps_the_existing_slug() {
        Guide existing = Guide.builder().id(7L).slug("ancien-titre").title("Ancien titre")
                .content("c").published(false).authorName("admin").build();
        when(guideRepository.findById(7L)).thenReturn(Optional.of(existing));
        when(guideRepository.save(any(Guide.class))).thenAnswer(i -> i.getArgument(0));

        GuideResponse res = service.update(7L, 1L, true, req("Tout nouveau titre", true));

        assertThat(res.slug()).isEqualTo("ancien-titre"); // URL stays stable
        assertThat(res.title()).isEqualTo("Tout nouveau titre");
        assertThat(res.published()).isTrue();
    }

    // ---- rôle Rédacteur (V18) : propriété vérifiée côté service ----

    @Test
    void editor_updates_his_own_guide_but_not_someone_elses() {
        User author = admin(); // id 1
        Guide own = Guide.builder().id(7L).slug("le-mien").title("T").content("c")
                .published(false).author(author).authorName("admin").build();
        when(guideRepository.findById(7L)).thenReturn(Optional.of(own));
        when(guideRepository.save(any(Guide.class))).thenAnswer(i -> i.getArgument(0));

        // Le propriétaire (non-admin) modifie et PUBLIE librement (option A validée)
        GuideResponse res = service.update(7L, 1L, false, req("Titre édité", true));
        assertThat(res.published()).isTrue();

        // Un AUTRE rédacteur (id 2) est refusé
        assertThatThrownBy(() -> service.update(7L, 2L, false, req("Vol", true)))
                .isInstanceOf(be.freenote.exception.ForbiddenException.class);
    }

    @Test
    void editor_cannot_touch_an_orphan_guide_but_an_admin_can() {
        Guide orphan = Guide.builder().id(9L).slug("orphelin").title("T").content("c")
                .published(true).author(null).authorName("ancien").build();
        when(guideRepository.findById(9L)).thenReturn(Optional.of(orphan));

        assertThatThrownBy(() -> service.delete(9L, 2L, false))
                .isInstanceOf(be.freenote.exception.ForbiddenException.class);

        service.delete(9L, 1L, true); // admin : OK (verify via absence d'exception)
    }
}
