export const CATEGORIES = ['SYNTHESE', 'EXAMEN', 'NOTES', 'EXERCICES', 'COURS', 'TFE', 'DIVERS'] as const;

export const MAX_FILE_SIZE = 7 * 1024 * 1024; // 7 MB (PDF)

// Image→PDF upload: up to 8 JPG/PNG images are merged server-side into one PDF.
export const MAX_IMAGES = 8;
export const IMAGE_MAX_SIZE = 8 * 1024 * 1024; // 8 MB per image (matches the backend multipart per-part cap)
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

// TanStack Query staleTime for rarely-changing data (sections, professors, news, tag suggestions).
// Backend caches these too (5 min Redis), so 15 min on the client avoids useless refetches between pages.
export const STALE_15M = 15 * 60 * 1000;
