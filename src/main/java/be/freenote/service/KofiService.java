package be.freenote.service;

import be.freenote.dto.request.KofiWebhookPayload;

public interface KofiService {
    void processWebhook(KofiWebhookPayload payload);

    /** Code personnel « FN-… » à coller dans le message d'un don Ko-fi pour le rattacher au compte. */
    String personalCode(Long userId);
}
