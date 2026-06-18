package be.freenote.config;

import org.springframework.core.io.Resource;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;
import java.time.Duration;
import java.util.Set;

/**
 * Serves the Vite SPA from {@code classpath:/static/} and falls back to {@code index.html}
 * for deep-link routes that React Router owns ({@code /browse}, {@code /profile/42}, …).
 * API, OAuth and actuator paths are never rewritten, so adding a new frontend route
 * requires zero backend changes.
 *
 * <p>The single fat jar produced by {@code ./gradlew bootJar} therefore contains both
 * the API and the SPA — ready to drop into a Proxmox LXC and run with {@code java -jar}.
 */
@Configuration
public class SpaForwardingConfig implements WebMvcConfigurer {

    /** Prefixes that must NOT fall back to index.html (they're backend endpoints). */
    private static final Set<String> BACKEND_PREFIXES = Set.of(
            "api/",
            "oauth2/",
            "login/",
            "actuator/"
    );

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Vite emits content-hashed files under /assets/** → cache forever (immutable). Cloudflare
        // and browsers then serve them from cache; the origin sends each asset essentially once.
        registry.addResourceHandler("/assets/**")
                .addResourceLocations("classpath:/static/assets/")
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable());

        // Everything else (index.html, favicon, og-image, SPA deep-link fallback): revalidate, so a
        // deploy propagates the fresh shell immediately (its hashed asset URLs have changed).
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .setCacheControl(CacheControl.noCache())
                .resourceChain(true)
                .addResolver(new SpaPathResourceResolver());
    }

    private static final class SpaPathResourceResolver extends PathResourceResolver {
        @Override
        protected Resource getResource(String resourcePath, Resource location) throws IOException {
            Resource requested = location.createRelative(resourcePath);
            // checkResource = the parent's isResourceUnderLocation guard: belt-and-suspenders against a
            // crafted "../"-style path escaping /static/ to read an arbitrary classpath resource
            // (e.g. application-*.yml). ResourceHttpRequestHandler.isInvalidPath already rejects such
            // paths upstream, but re-validating here keeps this custom resolver safe on its own.
            if (requested.exists() && requested.isReadable() && checkResource(requested, location)) {
                return requested;
            }
            // Backend paths: do not rewrite to index.html, let Spring return the normal 404/response.
            for (String prefix : BACKEND_PREFIXES) {
                if (resourcePath.startsWith(prefix)) {
                    return null;
                }
            }
            // SPA deep link — serve index.html so React Router can resolve it client-side.
            Resource index = location.createRelative("index.html");
            return index.exists() ? index : null;
        }
    }
}
