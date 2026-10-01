// Instrumentation d'usage anonyme (panel admin Analytics). Zéro cookie, zéro identifiant :
// une visite = une SESSION de navigation (30 min d'inactivité la clôturent), classée par
// provenance ; outils/guides/profils = 1 événement au montage de la page. Fire-and-forget : un
// échec réseau est avalé, le tracking ne doit jamais gêner l'utilisateur.
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

/** Valeur de `?src=` ramenée au format slug accepté par le serveur (sinon l'événement est ignoré). */
export function campaignSlug(search: string): string | null {
  const raw = new URLSearchParams(search).get('src');
  if (!raw) return null;
  // Accents retirés avant le remplacement, sinon « Rentrée » donnerait « rentr-e ».
  const slug = raw
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return /^[a-z0-9]/.test(slug) ? slug : null;
}

/**
 * Horodatage de la dernière activité, et marqueur de premier passage. `localStorage` et non
 * `sessionStorage` : ce dernier est **par onglet**, si bien que trois onglets ouverts comptaient
 * trois visites et qu'aucun retour n'était distinguable d'une première venue. Ce sont des
 * horodatages anonymes, pas un identifiant : rien ne permet de relier deux navigateurs.
 */
const LAST_SEEN = 'freenote-last-seen';
const KNOWN = 'freenote-known-visitor';
export const SESSION_GAP_MS = 30 * 60 * 1000;

/** Décide s'il faut compter une visite, et si c'est un premier passage. Pur, donc testable. */
export function visitDecision(lastSeen: string | null, now: number): { count: boolean } {
  if (!lastSeen) return { count: true };
  const previous = Number(lastSeen);
  if (!Number.isFinite(previous)) return { count: true };
  return { count: now - previous > SESSION_GAP_MS };
}

/**
 * Une visite par session de navigation. Un referrer interne n'en est pas une : c'est un onglet
 * ouvert depuis le site lui-même (lien en `target="_blank"`, « Voir le profil », PDF…). Il était
 * auparavant reclassé en « direct », ce qui gonflait silencieusement le plus gros poste du tableau
 * de provenance avec de la navigation interne — et rendait la part réelle de l'organique et du
 * social illisible.
 */
export function trackVisit(): void {
  const source = classifySource(document.referrer, window.location.search, window.location.host);
  if (source === 'internal') return;

  let shouldCount: boolean;
  let isNew: boolean;
  try {
    shouldCount = visitDecision(localStorage.getItem(LAST_SEEN), Date.now()).count;
    isNew = localStorage.getItem(KNOWN) === null;
    // L'horodatage est rafraîchi à chaque passage, même sans nouvelle visite : c'est lui qui
    // prolonge la session en cours.
    localStorage.setItem(LAST_SEEN, String(Date.now()));
    if (isNew) localStorage.setItem(KNOWN, '1');
  } catch {
    return; // stockage bloqué (navigation privée stricte) — tant pis pour la stat
  }
  if (!shouldCount) return;

  trackEvent('visit', source);
  if (isNew) trackEvent('visit_new', source);
  if (source === 'campaign') {
    const slug = campaignSlug(window.location.search);
    if (slug) trackEvent('campaign', slug);
  }
}

/** Usage d'un outil / lecture d'un guide / vue d'un profil (dédup profil côté serveur). */
export function trackUse(metric: 'tool' | 'guide' | 'profile', target: string): void {
  trackEvent(metric, target);
}
