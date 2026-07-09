package be.freenote.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record DonationResponse(
        Long id,
        Long userId,
        String username,
        BigDecimal amount,
        String kofiTransactionId,
        LocalDateTime adFreeUntil,
        /* Message Ko-fi (peut contenir le code « FN-… ») — aide l'admin à rattacher un don orphelin. */
        String message,
        LocalDateTime createdAt
) {}
