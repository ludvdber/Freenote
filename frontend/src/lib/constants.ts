export const CATEGORIES = ['SYNTHESE', 'EXAMEN', 'NOTES', 'EXERCICES', 'COURS', 'TFE', 'DIVERS'] as const;

export const MAX_FILE_SIZE = 7 * 1024 * 1024; // 7 MB

export const DISCORD_OAUTH_URL = '/oauth2/authorization/discord';

export const DISCORD_INVITE_URL =
  import.meta.env.VITE_DISCORD_INVITE_URL ?? 'https://discord.gg/5mYdsDSKk9';

export const KOFI_URL =
  import.meta.env.VITE_KOFI_URL ?? 'https://ko-fi.com/ludovic01';

export const GITHUB_URL =
  import.meta.env.VITE_GITHUB_URL ?? 'https://github.com/ludvdber/Freenote';

// TanStack Query staleTime for rarely-changing data (sections, professors, news, tag suggestions).
// Backend caches these too (5 min Redis), so 15 min on the client avoids useless refetches between pages.
export const STALE_15M = 15 * 60 * 1000;
