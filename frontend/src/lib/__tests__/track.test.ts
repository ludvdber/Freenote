import { describe, it, expect, vi } from 'vitest';

vi.mock('@/api/endpoints', () => ({ trackEvent: vi.fn() }));

import { classifySource, campaignSlug, visitDecision, SESSION_GAP_MS } from '../track';

const HOST = 'freenote.be';

describe('classifySource', () => {
  it('classes une arrivée sans referrer en direct', () => {
    expect(classifySource('', '', HOST)).toBe('direct');
  });

  it('fait primer ?src= (campagne) sur le referrer', () => {
    expect(classifySource('https://www.google.com/', '?src=qr-rentree', HOST)).toBe('campaign');
  });

  it('reconnaît les moteurs de recherche comme organique', () => {
    expect(classifySource('https://www.google.com/', '', HOST)).toBe('organic');
    expect(classifySource('https://www.bing.com/search?q=freenote', '', HOST)).toBe('organic');
    expect(classifySource('https://duckduckgo.com/', '', HOST)).toBe('organic');
  });

  it('reconnaît les réseaux sociaux (Discord inclus — canal n°1 du site)', () => {
    expect(classifySource('https://discord.com/channels/1/2', '', HOST)).toBe('social');
    expect(classifySource('https://ptb.discord.com/', '', HOST)).toBe('social');
    expect(classifySource('https://www.instagram.com/', '', HOST)).toBe('social');
  });

  it('classe le même hôte en interne et un site tiers en référent', () => {
    expect(classifySource('https://freenote.be/browse', '', HOST)).toBe('internal');
    expect(classifySource('https://www.isfce.org/', '', HOST)).toBe('referral');
  });

  it('tolère un referrer illisible', () => {
    expect(classifySource('pas-une-url', '', HOST)).toBe('direct');
  });
});

describe('trackVisit', () => {
  const setup = async (referrer: string) => {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
    Object.defineProperty(document, 'referrer', { value: referrer, configurable: true });
    const endpoints = await import('@/api/endpoints');
    vi.mocked(endpoints.trackEvent).mockClear();
    const { trackVisit } = await import('../track');
    return { trackVisit, trackEvent: endpoints.trackEvent };
  };

  it('compte une arrivée externe avec sa provenance', async () => {
    const { trackVisit, trackEvent } = await setup('https://discord.com/channels/1/2');
    trackVisit();
    expect(trackEvent).toHaveBeenCalledWith('visit', 'social');
  });

  /** Première venue de ce navigateur : la visite ET le marqueur « nouveau visiteur ». */
  it('marque un premier passage comme nouveau visiteur', async () => {
    const { trackVisit, trackEvent } = await setup('');
    trackVisit();
    expect(trackEvent).toHaveBeenNthCalledWith(1, 'visit', 'direct');
    expect(trackEvent).toHaveBeenNthCalledWith(2, 'visit_new', 'direct');
  });

  it('ne compte qu\'une fois par session de navigation', async () => {
    const { trackVisit, trackEvent } = await setup('');
    trackVisit();
    trackVisit();
    // Les deux appels du premier passage, et rien de plus : la session est toujours ouverte.
    expect(trackEvent).toHaveBeenCalledTimes(2);
  });

  /** Le retour après la coupure de session compte, mais plus comme un nouveau visiteur. */
  it('recompte après 30 minutes sans être un nouveau visiteur', async () => {
    const { trackVisit, trackEvent } = await setup('');
    trackVisit();
    vi.mocked(trackEvent).mockClear();
    localStorage.setItem('freenote-last-seen', String(Date.now() - 31 * 60 * 1000));

    trackVisit();

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('visit', 'direct');
  });

  /** Une campagne est comptée deux fois : dans le seau « campagne » et sous son propre nom. */
  it('détaille la campagne à partir de ?src=', async () => {
    const { trackVisit, trackEvent } = await setup('');
    window.history.replaceState({}, '', '/?src=QR_Rentree%202026');

    trackVisit();

    expect(trackEvent).toHaveBeenCalledWith('visit', 'campaign');
    expect(trackEvent).toHaveBeenCalledWith('campaign', 'qr-rentree-2026');
    window.history.replaceState({}, '', '/');
  });

  /** Un onglet ouvert depuis le site n'est pas une visite : avant, il gonflait « direct ». */
  it('ignore un referrer interne au lieu de le compter en direct', async () => {
    const { trackVisit, trackEvent } = await setup(`https://${window.location.host}/browse`);
    trackVisit();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  /** Et il ne doit pas ouvrir de session : la vraie visite suivante compte encore. */
  it('n\'ouvre pas de session sur un referrer interne', async () => {
    const { trackVisit, trackEvent } = await setup(`https://${window.location.host}/browse`);
    trackVisit();
    Object.defineProperty(document, 'referrer', { value: '', configurable: true });
    trackVisit();
    expect(trackEvent).toHaveBeenCalledWith('visit', 'direct');
  });
});

describe('visitDecision', () => {
  it('compte la toute première venue', () => {
    expect(visitDecision(null, 1_000_000).count).toBe(true);
  });

  it('ne recompte pas dans la fenêtre de session', () => {
    const now = 1_000_000;
    expect(visitDecision(String(now - SESSION_GAP_MS + 1), now).count).toBe(false);
  });

  it('recompte passé la fenêtre de session', () => {
    const now = 10_000_000;
    expect(visitDecision(String(now - SESSION_GAP_MS - 1), now).count).toBe(true);
  });

  /** Valeur corrompue (stockage trafiqué, ancienne version) : on compte, on ne plante pas. */
  it('tolère un horodatage illisible', () => {
    expect(visitDecision('pas-un-nombre', 1_000_000).count).toBe(true);
  });
});

describe('campaignSlug', () => {
  it('normalise la valeur de ?src= en slug', () => {
    expect(campaignSlug('?src=QR Rentrée_2026')).toBe('qr-rentree-2026');
    expect(campaignSlug('?src=flyer-b1')).toBe('flyer-b1');
  });

  it('renvoie null sans campagne ou sur une valeur inexploitable', () => {
    expect(campaignSlug('')).toBeNull();
    expect(campaignSlug('?src=___')).toBeNull();
  });
});
