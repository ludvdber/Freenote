/**
 * Sommaire automatique d'un contenu HTML (guides) : injecte un id stable sur chaque h2/h3 du HTML
 * DÉJÀ sanitisé et renvoie la liste des entrées — même grammaire que le sommaire PDF du rail
 * (2 niveaux max, borné). Pur (DOMParser), unit-testé.
 */

export interface TocEntry {
  id: string;
  text: string;
  /** 0 = h2 (chapitre), 1 = h3 (sous-section) — aligné sur PdfOutlineEntry.level. */
  level: 0 | 1;
}

/** Au-delà, la liste ne guide plus personne (même borne d'esprit que l'outline PDF). */
const MAX_TOC_ENTRIES = 40;

export function injectHeadingIds(html: string): { html: string; toc: TocEntry[] } {
  if (!html) return { html, toc: [] };
  const doc = new DOMParser().parseFromString(`<div id="__root">${html}</div>`, 'text/html');
  const root = doc.getElementById('__root');
  if (!root) return { html, toc: [] };

  const toc: TocEntry[] = [];
  root.querySelectorAll('h2, h3').forEach((el, i) => {
    if (toc.length >= MAX_TOC_ENTRIES) return;
    const text = el.textContent?.trim() ?? '';
    if (!text) return;
    const id = `guide-h-${i}`;
    el.id = id;
    toc.push({ id, text, level: el.tagName === 'H2' ? 0 : 1 });
  });
  return { html: root.innerHTML, toc };
}
