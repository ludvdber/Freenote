package be.freenote.service;

import be.freenote.dto.request.UpdateProfileRequest;
import be.freenote.dto.response.LeaderboardEntry;
import be.freenote.dto.response.UserResponse;
import be.freenote.entity.User;
import be.freenote.entity.UserProfile;
import be.freenote.exception.ResourceNotFoundException;
import be.freenote.mapper.UserMapper;
import be.freenote.repository.DocumentRepository;
import be.freenote.repository.ReportRepository;
import be.freenote.repository.UserRepository;
import be.freenote.service.impl.UserServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    @Mock private UserRepository userRepository;
    @Mock private DocumentRepository documentRepository;
    @Mock private ReportRepository reportRepository;
    @Mock private UserMapper userMapper;
    @Mock private ActivityLogService activityLogService;

    @InjectMocks private UserServiceImpl userService;

    private User userWithProfile() {
        User user = User.builder().id(1L).username("test").xp(50).role("USER").build();
        UserProfile profile = UserProfile.builder().user(user).build();
        user.setProfile(profile);
        return user;
    }

    // ---- addXp ----

    @Test
    void shouldIncrementXp() {
        User user = userWithProfile();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        userService.addXp(1L, 10);

        assertThat(user.getXp()).isEqualTo(60);
        verify(userRepository).save(user);
    }

    @Test
    void shouldThrowNotFoundWhenAddXpToNonExistentUser() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.addXp(999L, 10))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ---- deleteAccount ----

    @Test
    void shouldDetachReportsAnonymizeDocumentsAndDeleteUser() {
        User user = userWithProfile();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(reportRepository.findByUserId(1L)).thenReturn(List.of());

        userService.deleteAccount(1L);

        verify(reportRepository).findByUserId(1L);
        verify(reportRepository).saveAll(List.of());
        verify(documentRepository).anonymizeByUserId(1L);
        verify(userRepository).delete(user);
    }

    @Test
    void shouldThrowNotFoundWhenDeletingNonExistentUser() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.deleteAccount(999L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ---- acceptTerms ----

    @Test
    void shouldSetTermsAcceptedAt() {
        User user = userWithProfile();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        userService.acceptTerms(1L);

        assertThat(user.getProfile().getTermsAcceptedAt()).isNotNull();
    }

    @Test
    void shouldBeIdempotentWhenTermsAlreadyAccepted() {
        User user = userWithProfile();
        user.getProfile().setTermsAcceptedAt(java.time.LocalDateTime.of(2025, 1, 1, 0, 0));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        userService.acceptTerms(1L);

        // Should not overwrite existing timestamp
        assertThat(user.getProfile().getTermsAcceptedAt())
                .isEqualTo(java.time.LocalDateTime.of(2025, 1, 1, 0, 0));
    }

    @Test
    void shouldThrowWhenNoProfileOnAcceptTerms() {
        User user = User.builder().id(1L).username("test").build();
        user.setProfile(null);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> userService.acceptTerms(1L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ---- getLeaderboard ----

    @Test
    void shouldReturnLeaderboardOrderedByXp() {
        User u1 = User.builder().id(1L).username("top").xp(500).build();
        User u2 = User.builder().id(2L).username("second").xp(300).build();

        when(userRepository.findAllByOrderByXpDesc(any(Pageable.class))).thenReturn(List.of(u1, u2));
        List<Object[]> counts = new java.util.ArrayList<>();
        counts.add(new Object[]{1L, 10L});
        counts.add(new Object[]{2L, 5L});
        when(documentRepository.countByUserIds(List.of(1L, 2L))).thenReturn(counts);

        LeaderboardEntry e1 = new LeaderboardEntry(1L, 1, "top", "top", 500, 10L, false, null);
        LeaderboardEntry e2 = new LeaderboardEntry(2L, 2, "second", "second", 300, 5L, false, null);
        when(userMapper.toLeaderboardEntry(u1, 1, 10L)).thenReturn(e1);
        when(userMapper.toLeaderboardEntry(u2, 2, 5L)).thenReturn(e2);

        List<LeaderboardEntry> result = userService.getLeaderboard(10, null);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).rank()).isEqualTo(1);
        assertThat(result.get(1).rank()).isEqualTo(2);
    }

    // ---- updateProfile ----

    @Test
    void shouldUpdateProfileFields() {
        User user = userWithProfile();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        when(documentRepository.countByUserId(1L)).thenReturn(0L);
        UserResponse resp = new UserResponse(1L, "test", "USER", false, false, 50, "new bio", null, null, null, null,
                0L, true, false, false, false, null, "AUTO", "test", null, null, false, null, null, false, null);
        when(userMapper.toResponse(user, 0L)).thenReturn(resp);

        UpdateProfileRequest req = new UpdateProfileRequest();
        req.setBio("new bio");
        req.setProfilePublic(true);

        userService.updateProfile(1L, req);

        assertThat(user.getProfile().getBio()).isEqualTo("new bio");
        assertThat(user.getProfile().isProfilePublic()).isTrue();
    }

    @Test
    void shouldCreateProfileIfNullOnUpdate() {
        User user = User.builder().id(1L).username("test").xp(0).build();
        user.setProfile(null);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        when(documentRepository.countByUserId(1L)).thenReturn(0L);
        UserResponse resp = new UserResponse(1L, "test", "USER", false, false, 0, null, null, null, null, null,
                0L, false, false, false, false, null, "AUTO", "test", null, null, false, null, null, false, null);
        when(userMapper.toResponse(user, 0L)).thenReturn(resp);

        UpdateProfileRequest req = new UpdateProfileRequest();
        req.setBio("bio");

        userService.updateProfile(1L, req);

        assertThat(user.getProfile()).isNotNull();
        assertThat(user.getProfile().getBio()).isEqualTo("bio");
    }

    // ---- admin user management ----

    @Test
    void adminVerifyUser_shouldPromoteRoleToVerified() {
        User user = userWithProfile();
        user.setRole("USER");
        user.setVerified(false);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);
        when(userMapper.toResponse(user, 0L)).thenReturn(stubResponse());

        userService.adminVerifyUser(1L);

        assertThat(user.isVerified()).isTrue();
        assertThat(user.getRole()).isEqualTo("VERIFIED");
    }

    @Test
    void adminVerifyUser_shouldKeepAdminRole() {
        User user = userWithProfile();
        user.setRole("ADMIN");
        user.setVerified(false);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);
        when(userMapper.toResponse(user, 0L)).thenReturn(stubResponse());

        userService.adminVerifyUser(1L);

        assertThat(user.getRole()).isEqualTo("ADMIN");
        assertThat(user.isVerified()).isTrue();
    }

    @Test
    void adminUnverifyUser_shouldDemoteVerifiedRoleToUser() {
        User user = userWithProfile();
        user.setRole("VERIFIED");
        user.setVerified(true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);
        when(userMapper.toResponse(user, 0L)).thenReturn(stubResponse());

        userService.adminUnverifyUser(1L);

        assertThat(user.isVerified()).isFalse();
        assertThat(user.getRole()).isEqualTo("USER");
    }

    @Test
    void adminUnverifyUser_shouldKeepAdminRole() {
        User user = userWithProfile();
        user.setRole("ADMIN");
        user.setVerified(true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);
        when(userMapper.toResponse(user, 0L)).thenReturn(stubResponse());

        userService.adminUnverifyUser(1L);

        assertThat(user.getRole()).isEqualTo("ADMIN");
        assertThat(user.isVerified()).isFalse();
    }

    @Test
    void adminUpdateRole_shouldRejectInvalidValue() {
        assertThatThrownBy(() -> userService.adminUpdateRole(1L, "MODERATOR"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void adminUpdateRole_shouldForceVerifiedWhenPromoting() {
        User user = userWithProfile();
        user.setRole("USER");
        user.setVerified(false);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);
        when(userMapper.toResponse(user, 0L)).thenReturn(stubResponse());

        userService.adminUpdateRole(1L, "ADMIN");

        assertThat(user.getRole()).isEqualTo("ADMIN");
        assertThat(user.isVerified()).isTrue();
    }

    private static UserResponse stubResponse() {
        return new UserResponse(1L, "test", "USER", false, false, 0,
                null, null, null, null, null, 0L, false, false, false, false,
                null, "AUTO", "test", null, null, false, null, null, false, null);
    }
}
