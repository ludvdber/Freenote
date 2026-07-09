package be.freenote.service;

import be.freenote.dto.request.UpdateProfileRequest;
import be.freenote.dto.response.LeaderboardEntry;
import be.freenote.dto.response.ProfileCardResponse;
import be.freenote.dto.response.UserResponse;
import be.freenote.dto.response.UserStatsResponse;

import java.util.List;

public interface UserService {
    UserResponse getProfile(Long userId);
    UserResponse getPublicProfile(Long userId);
    UserResponse updateProfile(Long userId, UpdateProfileRequest request);
    /** Onboarding/profile: set the user's self-chosen username (marks usernameChosen=true). */
    UserResponse setUsername(Long userId, String username);
    /** Onboarding/profile: set (or clear, when sectionId is null) the user's academic section. */
    UserResponse setSection(Long userId, Long sectionId);
    List<LeaderboardEntry> getLeaderboard(int size, Long sectionId);
    /** 1-based global leaderboard rank of a user (by XP). */
    int getRank(Long userId);
    /** Stats agrégées pour les tuiles du profil public : vues cumulées + note moyenne reçue. */
    UserStatsResponse getUserStats(Long userId);
    List<ProfileCardResponse> getFeaturedProfiles();
    void addXp(Long userId, int amount);
    void deleteAccount(Long userId);
    void acceptTerms(Long userId);
    /** Re-pushes the Discord "verified" role for the current (verified) user — e.g. after they join
     *  the server, since the role is normally granted at email-verification time. */
    void syncDiscordRole(Long userId);
    /** Admin: list users with basic profile info, searchable by username and filterable by section. */
    List<UserResponse> adminSearchUsers(String query, Long sectionId, int limit);
    /** Admin: mark a user as verified (bypasses the @isfce.be email flow). */
    UserResponse adminVerifyUser(Long userId);
    /** Admin: revoke the verified flag. */
    UserResponse adminUnverifyUser(Long userId);
    /** Admin: mark a user as a trusted uploader (bypasses upload rate limits), or revoke it. */
    UserResponse adminSetTrusted(Long userId, boolean trusted);
    /** Admin : accorde/retire les palettes d'accent À VIE ({@code lifetime_supporter} — même flag
     *  qu'un don ≥ 5 €). L'octroi pousse aussi le rôle Discord Supporter (fire-and-forget). */
    UserResponse adminSetLifetimePalettes(Long userId, boolean enabled);
    /** Admin: update the role of a user (USER, VERIFIED, ADMIN). */
    UserResponse adminUpdateRole(Long userId, String role);
    /** Admin: delete a user account. Documents are anonymized (kept) — same semantics as self-deletion. */
    void adminDeleteUser(Long userId);
    /** Admin: permanently ban a user (by ISFCE email hash + Discord identity), then wipe the account.
     *  Re-login with the same Discord and re-verification with the same @isfce.be email are both blocked. */
    void banUser(Long targetUserId, String reason, Long adminId);
}
