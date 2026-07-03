package be.freenote.entity;

import be.freenote.enums.AvatarSource;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_profiles")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "userId")
public class UserProfile {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @Column(length = 500)
    private String bio;

    private String website;

    private String github;

    private String linkedin;

    private String discord;

    @Column(name = "discord_avatar_url", length = 512)
    private String discordAvatarUrl;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "section_id")
    private Section section;

    @Column(nullable = false)
    @Builder.Default
    private boolean profilePublic = true;

    @Column(nullable = false)
    @Builder.Default
    private boolean showInCarousel = true;

    private LocalDateTime adFreeUntil;

    private LocalDateTime termsAcceptedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "avatar_source", nullable = false, length = 20)
    @Builder.Default
    private AvatarSource avatarSource = AvatarSource.AUTO;

    @Column(name = "first_name", length = 50)
    private String firstName;

    @Column(name = "last_name", length = 50)
    private String lastName;

    @Column(name = "display_real_name", nullable = false)
    @Builder.Default
    private boolean displayRealName = false;

    /** Année d'arrivée à l'ISFCE (affichée sur le profil public si renseignée). */
    @Column(name = "study_start_year")
    private Integer studyStartYear;

    /** Année de fin / de diplôme — alimente le badge « Promo {année} » quand graduated est vrai. */
    @Column(name = "study_end_year")
    private Integer studyEndYear;

    @Column(nullable = false)
    @Builder.Default
    private boolean graduated = false;
}
