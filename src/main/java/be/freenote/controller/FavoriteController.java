package be.freenote.controller;

import be.freenote.security.SecurityUtils;
import be.freenote.dto.response.DocumentResponse;
import be.freenote.dto.response.PageResponse;
import be.freenote.service.FavoriteService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/favorites")
@RequiredArgsConstructor
public class FavoriteController {

    private static final int MAX_PAGE_SIZE = 50;

    private final FavoriteService favoriteService;

    // POST toggle plutôt que PUT+DELETE séparés : le frontend n'a qu'un seul bouton
    // favori, et le toggle en un seul appel simplifie la gestion d'état côté client.
    @PostMapping("/{docId}")
    public ResponseEntity<Map<String, Boolean>> toggle(Authentication authentication,
                                                        @PathVariable Long docId) {
        Long userId = SecurityUtils.currentUserId(authentication);
        boolean isFavorite = favoriteService.toggle(userId, docId);
        return ResponseEntity.ok(Map.of("isFavorite", isFavorite));
    }

    @GetMapping
    public ResponseEntity<PageResponse<DocumentResponse>> getFavorites(
            Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.ok(favoriteService.getFavorites(userId,
                PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), MAX_PAGE_SIZE))));
    }

    @GetMapping("/{docId}")
    public ResponseEntity<Map<String, Boolean>> status(Authentication authentication,
                                                        @PathVariable Long docId) {
        Long userId = SecurityUtils.currentUserId(authentication);
        return ResponseEntity.ok(Map.of("isFavorite", favoriteService.isFavorite(userId, docId)));
    }
}
