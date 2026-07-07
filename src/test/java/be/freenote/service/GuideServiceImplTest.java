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
        return new CreateGuideRequest(title, "Résumé", "# Contenu\n`x << 2`", "Java", "convertisseur-bases", published);
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

        assertThatThrownBy(() -> service.getPublishedBySlug("brouillon"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void update_keeps_the_existing_slug() {
        Guide existing = Guide.builder().id(7L).slug("ancien-titre").title("Ancien titre")
                .content("c").published(false).authorName("admin").build();
        when(guideRepository.findById(7L)).thenReturn(Optional.of(existing));
        when(guideRepository.save(any(Guide.class))).thenAnswer(i -> i.getArgument(0));

        GuideResponse res = service.update(7L, req("Tout nouveau titre", true));

        assertThat(res.slug()).isEqualTo("ancien-titre"); // URL stays stable
        assertThat(res.title()).isEqualTo("Tout nouveau titre");
        assertThat(res.published()).isTrue();
    }
}
