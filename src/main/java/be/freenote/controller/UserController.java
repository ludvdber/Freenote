package be.freenote.controller;

import be.freenote.security.SecurityUtils;
import be.freenote.dto.request.UpdateProfileRequest;
import be.freenote.dto.request.UpdateSectionRequest;
import be.freenote.dto.request.UpdateUsernameRequest;
import be.freenote.dto.response.DocumentResponse;
import be.freenote.dto.response.ProfileCardResponse;
import be.freenote.dto.response.UserResponse;
import be.freenote.security.JwtRevocationService;
import be.freenote.security.JwtTokenProvider;
import be.freenote.security.OAuth2LoginSuccessHandler;
import be.freenote.service.RecentDocsService;
import be.freenote.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final RecentDocsService recentDocsService;
    private final JwtTokenProvider jwtTokenProvider;
    private final JwtRevocationService jwtRevocationService;

    @Value("${app.cookie.secure:true}")
    private boolean cookieSecure;

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser(Authentication authentication) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.ok(userService.getProfile(userId));
    }

    @PutMapping("/me")
    public ResponseEntity<UserResponse> updateProfile(Authentication authentication,
                                                       @Valid @RequestBody UpdateProfileRequest request) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.ok(userService.updateProfile(userId, request));
    }

    @PutMapping("/me/username")
    public ResponseEntity<UserResponse> setUsername(Authentication authentication,
                                                    @Valid @RequestBody UpdateUsernameRequest request) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.ok(userService.setUsername(userId, request.getUsername()));
    }

    @PutMapping("/me/section")
    public ResponseEntity<UserResponse> setSection(Authentication authentication,
                                                   @Valid @RequestBody UpdateSectionRequest request) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.ok(userService.setSection(userId, request.getSectionId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getPublicProfile(id));
    }

    @GetMapping("/{id}/rank")
    public ResponseEntity<Integer> getUserRank(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getRank(id));
    }

    @GetMapping("/featured")
    public ResponseEntity<List<ProfileCardResponse>> getFeaturedProfiles() {
        return ResponseEntity.ok(userService.getFeaturedProfiles());
    }

    @GetMapping("/me/recent-docs")
    public ResponseEntity<List<DocumentResponse>> getRecentDocs(Authentication authentication,
                                                                 @RequestParam(defaultValue = "6") int limit) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.ok(recentDocsService.getRecent(userId, limit));
    }

    @PostMapping("/me/recent-docs/{docId}")
    public ResponseEntity<Void> recordVisit(Authentication authentication, @PathVariable Long docId) {
        Long userId = SecurityUtils.currentUserId(authentication);
        recentDocsService.recordVisit(userId, docId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/me/accept-terms")
    public ResponseEntity<Void> acceptTerms(Authentication authentication) {
        Long userId = SecurityUtils.currentUserId(authentication);
        userService.acceptTerms(userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/me/sync-discord-role")
    public ResponseEntity<Void> syncDiscordRole(Authentication authentication) {
        Long userId = SecurityUtils.currentUserId(authentication);
        userService.syncDiscordRole(userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteAccount(Authentication authentication,
                                               HttpServletRequest request,
                                               HttpServletResponse response) {
        Long userId = SecurityUtils.currentUserId(authentication);
        userService.deleteAccount(userId);

        // Revoke the JWT tied to this session so it cannot be reused while still within its TTL.
        var cookies = request.getCookies();
        if (cookies != null) {
            for (var c : cookies) {
                if ("jwt".equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()
                        && jwtTokenProvider.validateToken(c.getValue())) {
                    jwtRevocationService.revoke(
                            jwtTokenProvider.getJti(c.getValue()),
                            jwtTokenProvider.getExpiration(c.getValue()));
                    break;
                }
            }
        }

        OAuth2LoginSuccessHandler.clearJwtCookie(response, cookieSecure);
        return ResponseEntity.noContent().build();
    }
}
