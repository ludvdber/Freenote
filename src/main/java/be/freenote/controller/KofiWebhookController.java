package be.freenote.controller;

import be.freenote.dto.request.KofiWebhookPayload;
import be.freenote.security.ratelimit.RateLimit;
import be.freenote.service.KofiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.ObjectMapper;

@Slf4j
@RestController
@RequestMapping("/api/webhooks")
@RequiredArgsConstructor
public class KofiWebhookController {

    private final KofiService kofiService;
    private final ObjectMapper objectMapper;

    @PostMapping("/kofi")
    @RateLimit(max = 30, window = 60)
    public ResponseEntity<Void> handleKofiWebhook(@RequestParam(value = "data", required = false) String data) {
        if (data != null && !data.isBlank()) {
            try {
                KofiWebhookPayload payload = objectMapper.readValue(data, KofiWebhookPayload.class);
                kofiService.processWebhook(payload);
            } catch (Exception e) {
                // WARN, pas DEBUG : en prod (niveau INFO) un webhook réel qui échoue en parsing
                // serait sinon totalement invisible — un vrai don perdu sans aucune trace.
                log.warn("Ko-fi webhook parsing failed: {}", e.getMessage());
            }
        }
        // Always return 200 so Ko-fi doesn't retry endlessly
        return ResponseEntity.ok().build();
    }
}
