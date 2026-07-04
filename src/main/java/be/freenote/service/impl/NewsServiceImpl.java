package be.freenote.service.impl;

import be.freenote.dto.response.NewsItem;
import be.freenote.service.NewsService;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.w3c.dom.*;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class NewsServiceImpl implements NewsService {

    private static final String FEED_URL = "https://isfce.blogspot.com/feeds/posts/default";
    private static final String CACHE_KEY = "news:isfce";
    private static final Duration CACHE_TTL = Duration.ofMinutes(30);
    // First <img src="..."> in the post HTML → used as the /news magazine thumbnail.
    private static final Pattern IMG_SRC = Pattern.compile(
            "<img[^>]+src=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);

    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Override
    public List<NewsItem> getNews() {
        Object cached = redisTemplate.opsForValue().get(CACHE_KEY);
        if (cached != null) {
            try {
                List<NewsItem> items = objectMapper.convertValue(cached, new TypeReference<List<NewsItem>>() {});
                // Ignore a cache written by an older NewsItem schema (no post id) — otherwise every
                // detail link would point at /news/null until the 30-min TTL expired. Refetch fresh.
                if (!items.isEmpty() && items.stream().allMatch(n -> n.id() != null && !n.id().isBlank())) {
                    return items;
                }
            } catch (Exception e) {
                log.warn("Failed to deserialize cached news, fetching fresh");
            }
        }

        List<NewsItem> news = fetchFromFeed();
        if (!news.isEmpty()) {
            redisTemplate.opsForValue().set(CACHE_KEY, news, CACHE_TTL);
        }
        return news;
    }

    private List<NewsItem> fetchFromFeed() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(FEED_URL))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();

            HttpResponse<InputStream> response = httpClient.send(request,
                    HttpResponse.BodyHandlers.ofInputStream());

            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            // Disable external entities for security
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            DocumentBuilder builder = factory.newDocumentBuilder();
            org.w3c.dom.Document doc = builder.parse(response.body());

            NodeList entries = doc.getElementsByTagNameNS("http://www.w3.org/2005/Atom", "entry");
            List<NewsItem> items = new ArrayList<>();

            for (int i = 0; i < Math.min(entries.getLength(), 10); i++) {
                Element entry = (Element) entries.item(i);

                String id = extractPostId(getTextContent(entry, "id"));
                String title = getTextContent(entry, "title");
                String date = getTextContent(entry, "published");
                String content = getTextContent(entry, "content");

                // Extract link
                String url = null;
                NodeList links = entry.getElementsByTagNameNS("http://www.w3.org/2005/Atom", "link");
                for (int j = 0; j < links.getLength(); j++) {
                    Element link = (Element) links.item(j);
                    if ("alternate".equals(link.getAttribute("rel"))) {
                        url = link.getAttribute("href");
                        break;
                    }
                }

                // Extract labels/categories
                List<String> labels = new ArrayList<>();
                NodeList categories = entry.getElementsByTagNameNS(
                        "http://www.w3.org/2005/Atom", "category");
                for (int j = 0; j < categories.getLength(); j++) {
                    Element cat = (Element) categories.item(j);
                    String term = cat.getAttribute("term");
                    if (term != null && !term.isBlank()) {
                        labels.add(term);
                    }
                }

                // Guarantee a non-null id so the on-site /news/{id} link is never broken (and the
                // cache-validity guard in getNews() can't loop-refetch). The Atom <id> is normally
                // present; this only kicks in if it's missing.
                if (id == null || id.isBlank()) {
                    id = fallbackId(url);
                }

                items.add(new NewsItem(id, title, date, labels, url, content, extractThumbnail(content)));
            }

            return items;

        } catch (Exception e) {
            log.error("Failed to fetch ISFCE news feed: {}", e.getMessage());
            return List.of();
        }
    }

    private String getTextContent(Element parent, String tagName) {
        NodeList nodes = parent.getElementsByTagNameNS("http://www.w3.org/2005/Atom", tagName);
        if (nodes.getLength() > 0) {
            return nodes.item(0).getTextContent();
        }
        return null;
    }

    /** First {@code <img src>} in the post HTML, used as the /news magazine thumbnail (null if none).
     *  Blogger serves a resized copy via a {@code /sNNN[-c]/} or {@code /wNNN-hMMM/} path segment;
     *  we bump it to a larger crop so the hero isn't a blurry thumbnail (no-op for other hosts). */
    private String extractThumbnail(String content) {
        if (content == null || content.isBlank()) {
            return null;
        }
        Matcher m = IMG_SRC.matcher(content);
        if (!m.find()) {
            return null;
        }
        String src = m.group(1).trim();
        if (src.isEmpty()) {
            return null;
        }
        return src.replaceFirst("/s\\d+(-c)?/", "/s1600/")
                  .replaceFirst("/w\\d+-h\\d+(-[a-z-]+)?/", "/s1600/");
    }

    /** Atom entry id "tag:blogger.com,1999:blog-XXXX.post-YYYY" → the stable "YYYY" part (used as
     *  the slug for the on-site /news/{id} detail page). */
    private String extractPostId(String atomId) {
        if (atomId == null) {
            return null;
        }
        int idx = atomId.lastIndexOf(".post-");
        return idx >= 0 ? atomId.substring(idx + ".post-".length()) : atomId;
    }

    /** Stable slug derived from the post URL (last path segment, minus the .html suffix), used only
     *  when the Atom entry has no usable {@code <id>}. */
    private String fallbackId(String url) {
        if (url == null || url.isBlank()) {
            return String.valueOf(System.nanoTime());
        }
        String path = url;
        int q = path.indexOf('?');
        if (q >= 0) {
            path = path.substring(0, q);
        }
        int slash = path.lastIndexOf('/');
        String seg = slash >= 0 ? path.substring(slash + 1) : path;
        if (seg.endsWith(".html")) {
            seg = seg.substring(0, seg.length() - ".html".length());
        }
        return seg.isBlank() ? String.valueOf(Math.abs(url.hashCode())) : seg;
    }
}
