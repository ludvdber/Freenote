import { describe, it, expect, vi } from 'vitest';

vi.mock('@/api/endpoints', () => ({ trackEvent: vi.fn() }));

import { classifySource } from '../track';

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

  it('ne compte qu\'une fois par session', async () => {
    const { trackVisit, trackEvent } = await setup('');
    trackVisit();
    trackVisit();
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  /** Un onglet ouvert depuis le site n'est pas une visite : avant, il gonflait « direct ». */
  it('ignore un referrer interne au lieu de le compter en direct', async () => {
    const { trackVisit, trackEvent } = await setup(`https://${window.location.host}/browse`);
    trackVisit();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  /** Et il ne doit pas consommer le drapeau : la vraie visite suivante compte encore. */
  it('ne consomme pas le drapeau de session sur un referrer interne', async () => {
    const { trackVisit, trackEvent } = await setup(`https://${window.location.host}/browse`);
    trackVisit();
    Object.defineProperty(document, 'referrer', { value: '', configurable: true });
    trackVisit();
    expect(trackEvent).toHaveBeenCalledWith('visit', 'direct');
  });
});
