// Instrumentation d'usage anonyme (panel admin Analytics). Zéro cookie, zéro identifiant :
// une visite = 1 événement par session navigateur (sessionStorage), classée par provenance ;
// outils/guides/profils = 1 événement au montage de la page. Fire-and-forget : un échec réseau
// est avalé, le tracking ne doit jamais gêner l'utilisateur.
import { trackEvent } from '@/api/endpoints';

export type VisitSource = 'direct' | 'organic' | 'social' | 'referral' | 'campaign' | 'internal';

const SEARCH_ENGINES = ['google.', 'bing.com', 'duckduckgo.', 'qwant.', 'ecosia.', 'startpage.', 'yahoo.', 'search.brave.'];
const SOCIAL_HOSTS = ['discord', 't.co', 'twitter.', 'x.com', 'facebook.', 'fb.com', 'instagram.',
  'whatsapp.', 'messenger.', 'reddit.', 'linkedin.', 'tiktok.', 'snapchat.', 'telegram.', 'youtube.', 'youtu.be'];

/**
 * Classe la provenance d'une session. Pur (testable) : `referrer`/`search`/`host` sont passés
 * explicitement. `?src=…` (liens de campagne : QR, flyers, posts) prime sur le referrer.
 */
export function classifySource(referrer: string, search: string, host: string): VisitSource {
  if (new URLSearchParams(search).get('src')) return 'campaign';
  if (!referrer) return 'direct';
  let refHost: string;
  try {
    refHost = new URL(referrer).host.toLowerCase();
  } catch {
    return 'direct';
  }
  if (refHost === host.toLowerCase()) return 'internal';
  if (SEARCH_ENGINES.some((e) => refHost.includes(e))) return 'organic';
  if (SOCIAL_HOSTS.some((s) => refHost.includes(s))) return 'social';
  return 'referral';
}

const VISIT_FLAG = 'freenote-visit-tracked';

/** Une visite par session navigateur. « internal » (rechargement SPA) est compté en direct. */
export function trackVisit(): void {
  try {
    if (sessionStorage.getItem(VISIT_FLAG)) return;
    sessionStorage.setItem(VISIT_FLAG, '1');
  } catch {
    return; // sessionStorage bloqué (navigation privée stricte) — tant pis pour la stat
  }
  const source = classifySource(document.referrer, window.location.search, window.location.host);
  trackEvent('visit', source === 'internal' ? 'direct' : source);
}

/** Usage d'un outil / lecture d'un guide / vue d'un profil (dédup profil côté serveur). */
export function trackUse(metric: 'tool' | 'guide' | 'profile', target: string): void {
  trackEvent(metric, target);
}
