package be.freenote.controller;

import be.freenote.entity.Guide;
import be.freenote.repository.GuideRepository;
import be.freenote.service.PublicDocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * SEO servi par le backend (2026-07-08) : sitemap DYNAMIQUE (chaque guide publié y figure — l'ancien
 * {@code frontend/public/sitemap.xml} statique ne listait que l'index /guides) + flux RSS des guides.
 * Ces routes sont hors préfixe {@code api/} : GET couvert par le permitAll SPA/statique de
 * SecurityConfig, et le mapping controller PREND LE PAS sur le resource handler de
 * SpaForwardingConfig (RequestMappingHandlerMapping est prioritaire) — le fichier statique a été
 * supprimé pour éviter tout doublon.
 *
 * <p>⚠️ La liste des URLs statiques ci-dessous doit rester synchronisée avec les routes publiques
 * (App.tsx / toolsData.tsx) — même règle que l'ancien sitemap statique : ne JAMAIS y mettre une
 * route login-gated (Disallow robots.txt), ça flingue la confiance de crawl.
 */
@RestController
@RequiredArgsConstructor
public class SeoController {

    /** URL publique canonique — {@code app.frontend.url} (https://freenote.be en prod). */
    @Value("${app.frontend.url}")
    private String baseUrl;

    private final GuideRepository guideRepository;
    private final PublicDocumentService publicDocumentService;

    private static final ZoneId ZONE = ZoneId.of("Europe/Brussels");
    private static final int MAX_FEED_GUIDES = 200;

    /** Routes publiques fixes : path → [changefreq, priority]. Ordre = ordre d'émission. */
    private static final List<String[]> STATIC_URLS = List.of(
            new String[]{"/", "daily", "1.0"},
            new String[]{"/news", "daily", "0.6"},
            new String[]{"/browse", "daily", "0.7"},
            new String[]{"/guides", "weekly", "0.8"},
            new String[]{"/reviser", "daily", "0.8"},
            new String[]{"/a-propos", "monthly", "0.6"},
            new String[]{"/outils", "monthly", "0.8"},
            new String[]{"/outils/flashcards", "monthly", "0.8"},
            new String[]{"/outils/quiz", "monthly", "0.8"},
            new String[]{"/outils/calculateur-moyenne", "monthly", "0.7"},
            new String[]{"/outils/diagramme-uml", "monthly", "0.7"},
            new String[]{"/outils/gantt", "monthly", "0.7"},
            new String[]{"/outils/calculateur-ip", "monthly", "0.6"},
            new String[]{"/outils/calculateur-ipv6", "monthly", "0.6"},
            new String[]{"/outils/table-de-verite", "monthly", "0.6"},
            new String[]{"/outils/convertisseur-bases", "monthly", "0.6"},
            new String[]{"/outils/base64", "monthly", "0.6"},
            new String[]{"/outils/jwt", "monthly", "0.6"},
            new String[]{"/legal", "yearly", "0.3"},
            new String[]{"/privacy", "yearly", "0.3"},
            new String[]{"/terms", "yearly", "0.3"});

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> sitemap() {
        StringBuilder xml = new StringBuilder(4096);
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
           .append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
        for (String[] u : STATIC_URLS) {
            xml.append("  <url><loc>").append(baseUrl).append(u[0])
               .append("</loc><changefreq>").append(u[1])
               .append("</changefreq><priority>").append(u[2]).append("</priority></url>\n");
        }
        // Chaque guide publié — y compris members_only : la CARTE est listée publiquement (le
        // contenu seul est verrouillé), la page existe donc bien pour un crawler.
        for (Guide g : publishedGuides()) {
            xml.append("  <url><loc>").append(baseUrl).append("/guides/").append(escapeXml(g.getSlug()))
               .append("</loc><lastmod>").append(g.getUpdatedAt().toLocalDate())
               .append("</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>\n");
        }
        // Pages cours bi-modes (teaser public pour un anonyme) — uniquement les cours ayant au
        // moins un doc en catégorie publique, pour ne jamais indexer une page vide.
        for (Long courseId : publicDocumentService.publicCourseIds()) {
            xml.append("  <url><loc>").append(baseUrl).append("/courses/").append(courseId)
               .append("</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>\n");
        }
        xml.append("</urlset>\n");
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .body(xml.toString());
    }

    /** Flux RSS 2.0 des guides publiés — abonnement lecteur RSS + signal de fraîcheur SEO. */
    @GetMapping(value = "/rss.xml", produces = "application/rss+xml;charset=UTF-8")
    public ResponseEntity<String> guidesRss() {
        DateTimeFormatter rfc1123 = DateTimeFormatter.RFC_1123_DATE_TIME;
        StringBuilder xml = new StringBuilder(4096);
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
           .append("<rss version=\"2.0\"><channel>\n")
           .append("<title>Freenote — Guides</title>\n")
           .append("<link>").append(baseUrl).append("/guides</link>\n")
           .append("<description>Guides et tutoriels des étudiants de l'ISFCE — Freenote</description>\n")
           .append("<language>fr-BE</language>\n");
        for (Guide g : publishedGuides()) {
            String link = baseUrl + "/guides/" + escapeXml(g.getSlug());
            xml.append("<item>")
               .append("<title>").append(escapeXml(g.getTitle())).append("</title>")
               .append("<link>").append(link).append("</link>")
               .append("<guid isPermaLink=\"true\">").append(link).append("</guid>");
            if (g.getSummary() != null && !g.getSummary().isBlank()) {
                xml.append("<description>").append(escapeXml(g.getSummary())).append("</description>");
            }
            xml.append("<pubDate>")
               .append(rfc1123.format(g.getCreatedAt().atZone(ZONE)))
               .append("</pubDate></item>\n");
        }
        xml.append("</channel></rss>\n");
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .body(xml.toString());
    }

    private List<Guide> publishedGuides() {
        return guideRepository.findByPublishedTrueOrderByCreatedAtDesc(PageRequest.of(0, MAX_FEED_GUIDES))
                .getContent();
    }

    /** Titres/slugs stockés bruts (politique 2026-07-06) → échappement à l'émission XML. */
    private static String escapeXml(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&apos;");
    }
}
