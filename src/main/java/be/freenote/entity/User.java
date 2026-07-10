package be.freenote.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "users")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"profile", "ratings", "favorites", "reports", "donations", "delegateHistories", "oauthLinks"})
@EqualsAndHashCode(of = "id")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    /** False for a freshly-provisioned OAuth account that hasn't picked its own username yet. */
    @Column(name = "username_chosen", nullable = false)
    @Builder.Default
    private boolean usernameChosen = true;

    @Column(unique = true)
    private String emailHash;

    @Column(nullable = false)
    @Builder.Default
    private boolean verified = false;

    /** Trusted uploader (set by an admin): bypasses upload rate limits. Checked live by RateLimitAspect. */
    @Column(nullable = false)
    @Builder.Default
    private boolean trusted = false;

    /** Modérateur (V18) : accès au périmètre Modération du panel admin. Relu live en DB par
     *  AdminRoleVerificationFilter — un retrait prend effet à la requête suivante. */
    @Column(nullable = false)
    @Builder.Default
    private boolean moderator = false;

    /** Rédacteur (V18) : rédige des guides (CRUD sur SES propres guides, publication libre). */
    @Column(nullable = false)
    @Builder.Default
    private boolean editor = false;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String role = "USER";

    @Column(nullable = false)
    @Builder.Default
    private int xp = 0;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private UserProfile profile;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Rating> ratings = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Favorite> favorites = new ArrayList<>();

    @OneToMany(mappedBy = "user")
    @Builder.Default
    private List<Report> reports = new ArrayList<>();

    @OneToMany(mappedBy = "user")
    @Builder.Default
    private List<Donation> donations = new ArrayList<>();

    @OneToMany(mappedBy = "user")
    @Builder.Default
    private List<DelegateHistory> delegateHistories = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<UserOauthLink> oauthLinks = new ArrayList<>();
}
