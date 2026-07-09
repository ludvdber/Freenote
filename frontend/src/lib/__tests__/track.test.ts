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
