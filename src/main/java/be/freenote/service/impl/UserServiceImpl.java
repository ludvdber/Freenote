package be.freenote.service.impl;

import be.freenote.dto.request.UpdateProfileRequest;
import be.freenote.dto.response.LeaderboardEntry;
import be.freenote.dto.response.ProfileCardResponse;
import be.freenote.dto.response.UserResponse;
import be.freenote.dto.response.UserStatsResponse;
import be.freenote.entity.Ban;
import be.freenote.entity.Section;
import be.freenote.entity.User;
import be.freenote.entity.UserOauthLink;
import be.freenote.entity.UserProfile;
import be.freenote.enums.ActivityType;
import be.freenote.enums.AvatarSource;
import be.freenote.exception.DuplicateResourceException;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.mapper.UserMapper;
import be.freenote.repository.BanRepository;
import be.freenote.repository.DelegateHistoryRepository;
import be.freenote.repository.DocumentRepository;
import be.freenote.repository.RatingRepository;
import be.freenote.repository.Repositories;
import be.freenote.repository.ReportRepository;
import be.freenote.repository.SectionRepository;
import be.freenote.repository.UserOauthLinkRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.ActivityLogService;
import be.freenote.service.DiscordRoleService;
import be.freenote.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;
    private final RatingRepository ratingRepository;
    private final ReportRepository reportRepository;
    private final SectionRepository sectionRepository;
    private final UserOauthLinkRepository oauthLinkRepository;
    private final BanRepository banRepository;
    private final DelegateHistoryRepository delegateHistoryRepository;
    private final UserMapper userMapper;
    private final ActivityLogService activityLogService;
    private final DiscordRoleService discordRoleService;
    private final be.freenote.security.JwtRevocationService jwtRevocationService;

    @Override
    public UserResponse getProfile(Long userId) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        long docCount = documentRepository.countByUserId(userId);
        return userMapper.toResponse(user, docCount);
    }

    @Override
    public UserResponse getPublicProfile(Long userId) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        long docCount = documentRepository.countByUserId(userId);
        return userMapper.toPublicResponse(user, docCount);
    }

    @Override
    @Transactional
    public UserResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");

        UserProfile profile = user.getProfile();
        if (profile == null) {
            profile = UserProfile.builder().user(user).build();
            user.setProfile(profile);
        }

        // Stockage BRUT (trim seul) — même politique que les titres de documents : React échappe au
        // rendu. L'échappement à l'écriture corrompait l'affichage (« l&#x27;apostrophe ») et se
        // cumulait à chaque re-save du formulaire (V10 a nettoyé les valeurs existantes).
        profile.setBio(normalize(request.getBio()));
        profile.setWebsite(normalize(request.getWebsite()));
        profile.setGithub(normalize(request.getGithub()));
        profile.setLinkedin(normalize(request.getLinkedin()));
        profile.setDiscord(normalize(request.getDiscord()));
        profile.setProfilePublic(request.isProfilePublic());
        // Verified users (and admins) can opt in/out of the homepage carousel themselves.
        // Unverified accounts cannot — keeps the carousel away from throwaway accounts.
        if (user.isVerified() || "ADMIN".equals(user.getRole())) {
            profile.setShowInCarousel(request.isShowInCarousel());
        }
        if (request.getAvatarSource() != null) {
            profile.setAvatarSource(AvatarSource.valueOf(request.getAvatarSource()));
        }
        profile.setFirstName(normalize(request.getFirstName()));
        profile.setLastName(normalize(request.getLastName()));
        profile.setDisplayRealName(request.isDisplayRealName());
        if (request.getStudyStartYear() != null && request.getStudyEndYear() != null
                && request.getStudyEndYear() < request.getStudyStartYear()) {
            throw new IllegalArgumentException("L'année de fin ne peut pas précéder l'année de début.");
        }
        profile.setStudyStartYear(request.getStudyStartYear());
        profile.setStudyEndYear(request.getStudyEndYear());
        profile.setGraduated(request.isGraduated());

        User saved = userRepository.save(user);
        long docCount = documentRepository.countByUserId(userId);
        return userMapper.toResponse(saved, docCount);
    }

    @Override
    @Transactional
    public UserResponse setUsername(Long userId, String username) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        String trimmed = username.trim();
        if (!user.getUsername().equals(trimmed) && userRepository.existsByUsername(trimmed)) {
            throw new DuplicateResourceException("Ce pseudo est déjà pris");
        }
        user.setUsername(trimmed);
        user.setUsernameChosen(true);
        User saved = userRepository.save(user);
        long docCount = documentRepository.countByUserId(userId);
        return userMapper.toResponse(saved, docCount);
    }

    @Override
    @Transactional
    public UserResponse setSection(Long userId, Long sectionId) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        UserProfile profile = user.getProfile();
        if (profile == null) {
            profile = UserProfile.builder().user(user).build();
            user.setProfile(profile);
        }
        if (sectionId == null) {
            profile.setSection(null);
        } else {
            Section section = Repositories.findByIdOrThrow(sectionRepository, sectionId, "Section");
            profile.setSection(section);
        }
        User saved = userRepository.save(user);
        long docCount = documentRepository.countByUserId(userId);
        return userMapper.toResponse(saved, docCount);
    }

    @Override
    public List<LeaderboardEntry> getLeaderboard(int size, Long sectionId) {
        List<User> users = sectionId == null
                ? userRepository.findAllByOrderByXpDesc(PageRequest.of(0, size))
                : userRepository.findBySectionOrderByXpDesc(sectionId, PageRequest.of(0, size));

        // Batch fetch document counts + delegate status — 1 query each instead of N
        Map<Long, Long> docCounts = batchDocCounts(users);
        List<Long> ids = users.stream().map(User::getId).toList();
        java.util.Set<Long> activeDelegateIds = ids.isEmpty() ? java.util.Set.of()
                : new java.util.HashSet<>(delegateHistoryRepository.findActiveDelegateUserIds(ids));
        java.util.Set<Long> everDelegateIds = ids.isEmpty() ? java.util.Set.of()
                : new java.util.HashSet<>(delegateHistoryRepository.findAnyDelegateUserIds(ids));

        AtomicInteger rank = new AtomicInteger(1);
        return users.stream()
                .map(user -> {
                    boolean active = activeDelegateIds.contains(user.getId());
                    boolean former = !active && everDelegateIds.contains(user.getId());
                    return userMapper.toLeaderboardEntry(
                            user, rank.getAndIncrement(),
                            docCounts.getOrDefault(user.getId(), 0L),
                            active, former);
                })
                .toList();
    }

    @Override
    public int getRank(Long userId) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        return (int) userRepository.countByXpGreaterThan(user.getXp()) + 1;
    }

    @Override
    public UserStatsResponse getUserStats(Long userId) {
        // 404 si le compte n'existe pas — même contrat que getRank.
        Repositories.findByIdOrThrow(userRepository, userId, "User");
        long totalViews = documentRepository.sumDownloadCountByUserId(userId);
        Double avgRating = ratingRepository.avgScoreReceivedByUserId(userId);
        return new UserStatsResponse(totalViews, avgRating);
    }

    @Override
    public List<ProfileCardResponse> getFeaturedProfiles() {
        return userRepository.findFeaturedProfiles(PageRequest.of(0, 24)).stream()
                .map(userMapper::toProfileCard)
                .toList();
    }

    @Override
    @Transactional
    public void addXp(Long userId, int amount) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        // Les retraits (suppression de doc, unverify, re-notation à la baisse) ne descendent jamais
        // sous zéro — l'XP retiré peut dépasser l'XP restant si des gains ont été purgés entre-temps.
        user.setXp(Math.max(0, user.getXp() + amount));
        userRepository.save(user);
    }

    @Override
    @Transactional
    public void deleteAccount(Long userId) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        anonymizeAndDelete(user);
        log.info("Account deleted: userId={}, documents anonymized", userId);
    }

    @Override
    @Transactional
    public void adminDeleteUser(Long userId) {
        // Same data lifecycle as a self-delete. The caller (admin endpoint) doesn't need to revoke a
        // JWT since it's not the admin's own session.
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        anonymizeAndDelete(user);
        log.info("Admin deleted account: userId={}, username={}, documents anonymized", userId, user.getUsername());
    }

    @Override
    @Transactional
    public void banUser(Long targetUserId, String reason, Long adminId) {
        User user = Repositories.findByIdOrThrow(userRepository, targetUserId, "User");
        // Raison stockée brute (trim) — rendue uniquement par React (panel admin), qui échappe au rendu.
        String safeReason = normalize(reason);

        // Blacklist the verified ISFCE email (blocks re-verification with the same address).
        if (user.getEmailHash() != null) {
            banRepository.save(Ban.builder()
                    .emailHash(user.getEmailHash())
                    .reason(safeReason)
                    .bannedBy(adminId)
                    .build());
        }
        // Blacklist every linked Discord identity (blocks re-login with the same Discord).
        for (UserOauthLink link : oauthLinkRepository.findByUserId(targetUserId)) {
            banRepository.save(Ban.builder()
                    .oauthProvider(link.getProvider())
                    .oauthId(link.getOauthId())
                    .reason(safeReason)
                    .bannedBy(adminId)
                    .build());
        }

        anonymizeAndDelete(user);
        activityLogService.log(ActivityType.USER_BAN, adminId, "Admin", "Bannissement: " + user.getUsername());
        log.warn("Admin {} banned and wiped user: id={}, username={}", adminId, targetUserId, user.getUsername());
    }

    /** Shared account-removal lifecycle: detach reports (kept for moderation), anonymize documents
     *  (kept as 'Anonyme'), delete the row (cascades profile + oauth links), and revoke every JWT
     *  the account still holds — without this, a banned/wiped user's cookie stays valid up to 24 h
     *  and keeps ROLE_VERIFIED read access (the JWT is stateless, the user row is gone). */
    private void anonymizeAndDelete(User user) {
        var reports = reportRepository.findByUserId(user.getId());
        for (var report : reports) {
            report.setUser(null);
        }
        reportRepository.saveAll(reports);
        documentRepository.anonymizeByUserId(user.getId());
        userRepository.delete(user);
        jwtRevocationService.revokeAllForUser(user.getId());
    }

    @Override
    public void syncDiscordRole(Long userId) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        // Only verified accounts get the "verified" role; nothing to do otherwise.
        if (!user.isVerified()) {
            return;
        }
        oauthLinkRepository.findByUserId(userId).stream()
                .filter(link -> "DISCORD".equals(link.getProvider()))
                .findFirst()
                .ifPresent(link -> discordRoleService.assignVerifiedRole(link.getOauthId()));
    }

    @Override
    @Transactional
    public void acceptTerms(Long userId) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        UserProfile profile = user.getProfile();
        if (profile == null) {
            throw new ResourceNotFoundException("UserProfile", "userId", userId);
        }
        if (profile.getTermsAcceptedAt() != null) {
            return; // already accepted — idempotent
        }
        profile.setTermsAcceptedAt(java.time.LocalDateTime.now());
    }

    @Override
    public List<UserResponse> adminSearchUsers(String query, Long sectionId, int limit) {
        int clamped = Math.min(Math.max(limit, 1), 100);
        String q = query == null ? "" : query.trim();
        List<User> users = sectionId == null
                ? userRepository.searchByUsername(q, PageRequest.of(0, clamped))
                : userRepository.searchByUsernameAndSection(q, sectionId, PageRequest.of(0, clamped));
        Map<Long, Long> docCounts = batchDocCounts(users);
        return users.stream()
                .map(u -> userMapper.toResponse(u, docCounts.getOrDefault(u.getId(), 0L)))
                .toList();
    }

    @Override
    @Transactional
    public UserResponse adminVerifyUser(Long userId) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        user.setVerified(true);
        if ("USER".equals(user.getRole())) {
            user.setRole("VERIFIED");
        }
        User saved = userRepository.save(user);
        long docCount = documentRepository.countByUserId(userId);
        log.info("Admin manually verified user: id={}, username={}", userId, user.getUsername());
        return userMapper.toResponse(saved, docCount);
    }

    @Override
    @Transactional
    public UserResponse adminUnverifyUser(Long userId) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        user.setVerified(false);
        if ("VERIFIED".equals(user.getRole())) {
            user.setRole("USER");
        }
        User saved = userRepository.save(user);
        long docCount = documentRepository.countByUserId(userId);
        log.info("Admin revoked verification for user: id={}, username={}", userId, user.getUsername());
        return userMapper.toResponse(saved, docCount);
    }

    @Override
    @Transactional
    public UserResponse adminSetTrusted(Long userId, boolean trusted) {
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        user.setTrusted(trusted);
        User saved = userRepository.save(user);
        long docCount = documentRepository.countByUserId(userId);
        log.info("Admin set trusted={} for user: id={}, username={}", trusted, userId, user.getUsername());
        return userMapper.toResponse(saved, docCount);
    }

    @Override
    @Transactional
    public UserResponse adminUpdateRole(Long userId, String role) {
        if (role == null || !(role.equals("USER") || role.equals("VERIFIED") || role.equals("ADMIN"))) {
            throw new IllegalArgumentException("Role must be USER, VERIFIED or ADMIN");
        }
        User user = Repositories.findByIdOrThrow(userRepository, userId, "User");
        user.setRole(role);
        if (role.equals("VERIFIED") || role.equals("ADMIN")) {
            user.setVerified(true);
        } else {
            // Cohérence du modèle : USER ⇔ non vérifié (miroir de adminUnverifyUser). Sans ça, un
            // rétrogradé affichait « USER » dans le panel tout en gardant verified=true en base.
            user.setVerified(false);
        }
        User saved = userRepository.save(user);
        long docCount = documentRepository.countByUserId(userId);
        log.info("Admin updated role for user: id={}, role={}", userId, role);
        return userMapper.toResponse(saved, docCount);
    }

    /** Trim + null si vide — les champs texte du profil sont stockés bruts (React échappe au rendu). */
    private static String normalize(String input) {
        if (input == null) return null;
        String trimmed = input.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /** Fetches document counts for a list of users in a single query. */
    private Map<Long, Long> batchDocCounts(List<User> users) {
        List<Long> ids = users.stream().map(User::getId).toList();
        if (ids.isEmpty()) return Map.of();
        return documentRepository.countByUserIds(ids).stream()
                .collect(Collectors.toMap(
                        row -> (Long) row[0],
                        row -> (Long) row[1]
                ));
    }

}
