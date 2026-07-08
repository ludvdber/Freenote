import { describe, it, expect } from 'vitest';
import { injectHeadingIds } from '../toc';

describe('injectHeadingIds', () => {
  it('injecte des ids sur les h2/h3 et renvoie le sommaire dans l\'ordre', () => {
    const { html, toc } = injectHeadingIds(
      '<h2>Intro</h2><p>x</p><h3>Détail</h3><h2>Suite</h2>',
    );
    expect(toc).toEqual([
      { id: 'guide-h-0', text: 'Intro', level: 0 },
      { id: 'guide-h-1', text: 'Détail', level: 1 },
      { id: 'guide-h-2', text: 'Suite', level: 0 },
    ]);
    expect(html).toContain('<h2 id="guide-h-0">Intro</h2>');
    expect(html).toContain('<h3 id="guide-h-1">Détail</h3>');
  });

  it('ignore h1/h4 et les titres vides', () => {
    const { toc } = injectHeadingIds('<h1>Titre</h1><h2>  </h2><h4>Profond</h4><h2>Seul</h2>');
    expect(toc).toEqual([{ id: 'guide-h-1', text: 'Seul', level: 0 }]);
  });

  it('rend le HTML inchangé (hors ids) et [] pour un contenu sans titres', () => {
    const { html, toc } = injectHeadingIds('<p>que du texte</p>');
    expect(toc).toEqual([]);
    expect(html).toBe('<p>que du texte</p>');
  });

  it('borne le sommaire à 40 entrées', () => {
    const many = Array.from({ length: 50 }, (_, i) => `<h2>T${i}</h2>`).join('');
    expect(injectHeadingIds(many).toc).toHaveLength(40);
  });
});
