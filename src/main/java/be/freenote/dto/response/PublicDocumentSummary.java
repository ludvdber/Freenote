package be.freenote.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * A copyright-safe public teaser of a document — metadata only, NO author and NO file. Exposed
 * anonymously (SEO + AdSense surface) for the low-risk categories (Notes, Divers) only; the PDF
 * itself stays behind the verified-email gate. The author is deliberately omitted (anonymised).
 */
public record PublicDocumentSummary(
        Long id,
        String title,
        String courseName,
        String sectionName,
        String category,
        String year,
        BigDecimal averageRating,
        int ratingCount,
        LocalDateTime createdAt
) {}
