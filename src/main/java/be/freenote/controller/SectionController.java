package be.freenote.controller;

import be.freenote.dto.response.SectionResponse;
import be.freenote.service.SectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/sections")
@RequiredArgsConstructor
public class SectionController {

    private final SectionService sectionService;

    @GetMapping
    public ResponseEntity<List<SectionResponse>> getAll() {
        return ResponseEntity.ok()
                // private : endpoint authentifié par cookie — jamais de cache partagé sur ces réponses.
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(2)).cachePrivate())
                .body(sectionService.getAll());
    }
}
