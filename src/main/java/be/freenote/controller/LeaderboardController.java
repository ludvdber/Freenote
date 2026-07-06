package be.freenote.controller;

import be.freenote.dto.response.LeaderboardEntry;
import be.freenote.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/leaderboard")
@RequiredArgsConstructor
public class LeaderboardController {

    private final UserService userService;

    @GetMapping
    public ResponseEntity<List<LeaderboardEntry>> getLeaderboard(
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) Long sectionId) {
        int clamped = Math.max(1, Math.min(size, 100));
        return ResponseEntity.ok()
                // private : endpoint authentifié par cookie — un cache partagé (Cloudflare/proxy)
                // ne doit jamais stocker une réponse à cookie (convention DocumentController.getPopular).
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(2)).cachePrivate())
                .body(userService.getLeaderboard(clamped, sectionId));
    }
}
