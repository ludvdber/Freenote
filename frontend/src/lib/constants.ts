// App version (SemVer). Source of truth stays build.gradle.kts `version`; kept here for reference and
// potential reuse (not displayed in the UI). 1.x.0 = features, 1.0.x = fixes.
export const APP_VERSION = '1.19.0';

export const CATEGORIES = ['SYNTHESE', 'EXAMEN', 'NOTES', 'EXERCICES', 'COURS', 'TFE', 'DIVERS'] as const;

export const MAX_FILE_SIZE = 7 * 1024 * 1024; // 7 MB (PDF)

// Image→PDF upload: up to 8 JPG/PNG images are merged server-side into one PDF.
export const MAX_IMAGES = 8;
export const IMAGE_MAX_SIZE = 8 * 1024 * 1024; // 8 MB per image (matches the backend multipart per-part cap)
// Keep the whole multipart request under the backend's 50 MB max-request-size (leaving room for overhead).
export const MAX_TOTAL_UPLOAD = 45 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png'] as const;

export const DISCORD_OAUTH_URL = '/oauth2/authorization/discord';

export const DISCORD_INVITE_URL =
  import.meta.env.VITE_DISCORD_INVITE_URL ?? 'https://discord.gg/5mYdsDSKk9';

export const KOFI_URL =
  import.meta.env.VITE_KOFI_URL ?? 'https://ko-fi.com/ludovic01';

export const GITHUB_URL =
  import.meta.env.VITE_GITHUB_URL ?? 'https://github.com/ludvdber/Freenote';

// Public site origin (no trailing slash) — used to build canonical / og / JSON-LD URLs for SEO.
export const SITE_URL =
  (import.meta.env.VITE_SITE_URL ?? 'https://freenote.be').replace(/\/$/, '');

// Google AdSense. The publisher (client) id is also hard-coded in index.html's loader.
// A real <ins> ad unit only renders when a slot id is provided via VITE_ADSENSE_SLOT — otherwise
// AdBanner falls back to the styled placeholder, so dev/preview never shows a broken/empty unit.
// EEA consent is handled by Google's certified CMP (configured in the AdSense console, loaded by
// adsbygoogle.js) via Consent Mode v2 — no slot-level consent JS needed here.
export const ADSENSE_CLIENT =
  import.meta.env.VITE_ADSENSE_CLIENT ?? 'ca-pub-3398993252100042';
export const ADSENSE_SLOT = import.meta.env.VITE_ADSENSE_SLOT ?? '';

// TanStack Query staleTime for rarely-changing data (sections, professors, news, tag suggestions).
// Backend caches these too (5 min Redis), so 15 min on the client avoids useless refetches between pages.
export const STALE_15M = 15 * 60 * 1000;
