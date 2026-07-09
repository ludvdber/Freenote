import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, IconButton, InputBase, Typography, CircularProgress, Button } from '@mui/material';
import { ZoomIn, ZoomOut, OpenInNew, Search, Close, KeyboardArrowUp, KeyboardArrowDown } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
// Vite serves the worker as a same-origin hashed asset (no CDN, CSP-friendly).
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { downloadDocument } from '@/api/endpoints';
import * as s from './PdfViewer.styles';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
// Bornes de la hauteur « une page » du conteneur (voir viewerHeight ci-dessous).
const MIN_VIEWER_H = 480;
const MAX_VIEWER_H = 1500;
// Le sommaire d'un PDF pathologique peut compter des centaines d'entrées — on borne ce qu'on
// remonte au rail (au-delà, la liste ne guide plus personne).
const MAX_OUTLINE_ENTRIES = 60;

/** Une entrée du sommaire (outline) du PDF, résolue en numéro de page. */
export interface PdfOutlineEntry {
  title: string;
  page: number;
  /** 0 = chapitre, 1 = sous-section (on ne descend pas plus profond). */
  level: number;
}

/** Contrôle imperatif exposé au parent (saut de page depuis le sommaire du rail). */
export interface PdfViewerHandle {
  scrollToPage: (page: number) => void;
}

/** Normalisation de la recherche dans le PDF : accents/casse ignorés (même règle que ⌘K). */
function normText(s: string): string {
  return s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
}

function countOccurrences(text: string, q: string): number {
  let n = 0;
  let i = text.indexOf(q);
  while (i !== -1) {
    n++;
    i = text.indexOf(q, i + q.length);
  }
  return n;
}

/** Aplati l'outline pdf.js (2 niveaux max) en résolvant chaque destination en numéro de page. */
async function extractOutline(pdf: PDFDocumentProxy): Promise<PdfOutlineEntry[]> {
  const outline = await pdf.getOutline();
  if (!outline?.length) return [];
  const acc: PdfOutlineEntry[] = [];
  const walk = async (items: typeof outline, level: number) => {
    for (const item of items) {
      if (acc.length >= MAX_OUTLINE_ENTRIES) return;
      try {
        // dest : soit un tableau [pageRef, …], soit un nom à résoudre via getDestination.
        const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
        if (Array.isArray(dest) && dest[0] != null) {
          const pageIndex = await pdf.getPageIndex(dest[0]);
          const title = item.title?.trim();
          if (title) acc.push({ title, page: pageIndex + 1, level });
        }
      } catch { /* destination cassée — on saute l'entrée, pas tout le sommaire */ }
      if (level === 0 && item.items?.length) await walk(item.items, 1);
    }
  };
  await walk(outline, 0);
  return acc;
}

interface PdfViewerProps {
  docId: number;
  title: string;
  /** Reçoit le sommaire du PDF une fois extrait ([] si le PDF n'en a pas). */
  onOutline?: (entries: PdfOutlineEntry[]) => void;
  /** Prop plutôt que ref React : le composant est chargé via lazy(), une prop explicite
   *  évite toute ambiguïté de transmission de ref à travers Suspense. */
  controllerRef?: React.RefObject<PdfViewerHandle | null>;
}

/**
 * Renders an authenticated PDF to <canvas> with pdf.js — works inline on every device, including
 * mobile browsers that refuse to display a PDF inside an <iframe> (the old approach). The bytes are
 * fetched through the same authenticated endpoint (cookie-based), so nothing is exposed publicly.
 *
 * Continuous vertical scroll (reads like a real PDF): every page is stacked, but only the pages near
 * the viewport are actually rendered (IntersectionObserver, bounded memory) — the rest reserve their
 * space with a sized placeholder so the scrollbar and layout stay stable. Zoom re-renders on the fly;
 * the page indicator follows the scroll position.
 */
export default function PdfViewer({ docId, title, onOutline, controllerRef }: PdfViewerProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const wrapRefs = useRef<(HTMLDivElement | null)[]>([]);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const renderTasks = useRef<(RenderTask | null)[]>([]);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);

  const [numPages, setNumPages] = useState(0);
  // h/w ratio used to size not-yet-rendered pages (from page 1; corrected per page on render).
  const [defaultAspect, setDefaultAspect] = useState(1.414); // A4 portrait until page 1 is measured
  const [zoom, setZoom] = useState(1);
  const [availWidth, setAvailWidth] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Recherche dans le PDF (zone visible — pensée pour qui ne connaît pas Ctrl+F) : `hl` est la
  // requête EXÉCUTÉE (normalisée) qui pilote le surlignage ; la navigation saute de page en page
  // parmi celles qui contiennent le mot. Texte extrait une fois par page (cache par docId).
  const [query, setQuery] = useState('');
  const [hl, setHl] = useState('');
  const [matchPages, setMatchPages] = useState<number[]>([]);
  const [matchPos, setMatchPos] = useState(0);
  const [totalHits, setTotalHits] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const textCacheRef = useRef<(string | undefined)[]>([]);

  // Reset to the loading state when the document changes (the component stays mounted when navigating
  // between docs). Adjusting state during render — React's recommended pattern — keeps it out of an
  // effect, same as DocumentView does for favStatus.
  const [prevDocId, setPrevDocId] = useState(docId);
  if (docId !== prevDocId) {
    setPrevDocId(docId);
    setLoaded(false);
    setError(false);
    setNumPages(0);
    setZoom(1);
    setCurrentPage(1);
    setQuery('');
    setHl('');
    setMatchPages([]);
    setMatchPos(0);
    setTotalHits(null);
    // The ref arrays are NOT reset here (writing a ref during render is disallowed): setting numPages
    // to 0 unmounts the old pages, whose ref callbacks null out their slots, and the load effect's
    // cleanup cancels any in-flight render tasks. Le cache texte est vidé dans l'effet de chargement.
  }

  // Latest-ref : l'identité de onOutline ne doit pas invalider l'effet de chargement (sinon un
  // parent qui re-render re-téléchargerait le PDF). Mis à jour dans un effet (déclaré avant celui
  // du chargement — l'ordre d'exécution des effets suit l'ordre de déclaration).
  const onOutlineRef = useRef(onOutline);
  useEffect(() => { onOutlineRef.current = onOutline; }, [onOutline]);

  // Load the document once, fetching bytes through the authenticated endpoint.
  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
    const tasks = renderTasks.current; // stable array instance — safe to reference in cleanup
    textCacheRef.current = []; // texte extrait par page — propre au document courant
    onOutlineRef.current?.([]); // reset : pas de sommaire périmé pendant le chargement du doc suivant
    (async () => {
      try {
        const blob = await downloadDocument(docId);
        const data = await blob.arrayBuffer();
        if (cancelled) return;
        loadingTask = pdfjsLib.getDocument({ data });
        const pdf = await loadingTask.promise;
        if (cancelled) { loadingTask.destroy(); return; }
        pdfRef.current = pdf;
        const first = await pdf.getPage(1);
        if (cancelled) return;
        const v = first.getViewport({ scale: 1 });
        setDefaultAspect(v.height / v.width);
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setLoaded(true);
        // Sommaire (outline) — best-effort : un PDF sans outline ou aux destinations cassées
        // donne simplement [], le rail masque alors la carte.
        try {
          const entries = await extractOutline(pdf);
          if (!cancelled) onOutlineRef.current?.(entries);
        } catch { /* outline illisible — on n'affiche rien */ }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      tasks.forEach((rt) => rt?.cancel());
      loadingTask?.destroy(); // frees the document + worker resources
      pdfRef.current = null;
    };
  }, [docId]);

  // Scroll du conteneur interne vers une page — partagé entre le sommaire du rail (controllerRef)
  // et la navigation de la recherche (le rendu suit tout seul via l'IntersectionObserver).
  const scrollToPage = useCallback((page: number) => {
    const container = containerRef.current;
    const wrap = wrapRefs.current[page - 1];
    if (!container || !wrap) return;
    const delta = wrap.getBoundingClientRect().top - container.getBoundingClientRect().top;
    container.scrollTo({ top: container.scrollTop + delta - 8, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!controllerRef) return;
    controllerRef.current = { scrollToPage };
    return () => { controllerRef.current = null; };
  }, [controllerRef, scrollToPage]);

  // Exécute la recherche : extrait (et met en cache) le texte de chaque page, compte les
  // occurrences, active le surlignage et saute à la première page qui matche.
  const runSearch = useCallback(async () => {
    const q = normText(query.trim());
    const pdf = pdfRef.current;
    if (!q || !pdf) {
      setHl('');
      setMatchPages([]);
      setMatchPos(0);
      setTotalHits(null);
      return;
    }
    setSearching(true);
    try {
      const pages: number[] = [];
      let hits = 0;
      for (let p = 1; p <= pdf.numPages; p++) {
        let text = textCacheRef.current[p];
        if (text == null) {
          const tc = await pdf.getPage(p).then((pg) => pg.getTextContent());
          text = normText((tc.items as Array<{ str?: string }>).map((it) => it.str ?? '').join(' '));
          textCacheRef.current[p] = text;
        }
        const n = countOccurrences(text, q);
        if (n > 0) {
          pages.push(p);
          hits += n;
        }
      }
      setHl(q);
      setMatchPages(pages);
      setMatchPos(0);
      setTotalHits(hits);
      if (pages.length) scrollToPage(pages[0]);
    } catch {
      setTotalHits(0); // extraction impossible (PDF scanné sans texte) — « aucun résultat » honnête
    } finally {
      setSearching(false);
    }
  }, [query, scrollToPage]);

  const gotoMatch = useCallback((dir: 1 | -1) => {
    if (!matchPages.length) return;
    const next = (matchPos + dir + matchPages.length) % matchPages.length;
    setMatchPos(next);
    scrollToPage(matchPages[next]);
  }, [matchPages, matchPos, scrollToPage]);

  const clearSearch = () => {
    setQuery('');
    setHl('');
    setMatchPages([]);
    setMatchPos(0);
    setTotalHits(null);
  };

  // Available width for fit-to-width — measured on a width:100% ruler so it stays the *visible* inner
  // width even when a zoomed page overflows and makes the scroll container wider than the viewport.
  // Hystérèse 24 px : la hauteur du viewer dépend de cette largeur, donc un viewer monté dans une
  // page à hauteur variable (aperçu admin en Collapse) peut faire apparaître/disparaître la barre de
  // défilement verticale (~15-17 px) à chaque re-render → largeur qui oscille → « tremblement »
  // infini gauche-droite. On ignore toute variation plus petite qu'une barre de défilement.
  useEffect(() => {
    const el = rulerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      setAvailWidth((prev) => (prev !== 0 && Math.abs(w - prev) < 24 ? prev : w));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loaded]);

  // Render a single page into its canvas at the current fit-width × zoom. Idempotent per scale via a
  // data-attr key (qui inclut la requête surlignée), so an already-rendered page is skipped until
  // the zoom/width/recherche actually changes.
  const renderPage = useCallback(async (page: number) => {
    const pdf = pdfRef.current;
    const canvas = canvasRefs.current[page - 1];
    if (!pdf || !canvas || !availWidth) return;
    const key = `${availWidth}:${zoom}:${hl}`;
    if (canvas.dataset.k === key) return;

    let proxy;
    try { proxy = await pdf.getPage(page); } catch { return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const base = proxy.getViewport({ scale: 1 });
    const viewport = proxy.getViewport({ scale: (availWidth / base.width) * zoom });
    const dpr = window.devicePixelRatio || 1;

    renderTasks.current[page - 1]?.cancel(); // a pending render on this canvas would throw otherwise
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    const task = proxy.render({
      canvas,
      canvasContext: ctx,
      viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
    });
    renderTasks.current[page - 1] = task;
    try {
      await task.promise;
      // Surlignage best-effort de la recherche : rectangle jaune sur chaque occurrence, positionné
      // depuis la géométrie des items texte (approximation proportionnelle dans l'item — suffisant
      // pour du texte horizontal ; un mot coupé entre deux items est compté mais pas surligné).
      if (hl) {
        try {
          const tc = await proxy.getTextContent();
          ctx.save();
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.fillStyle = 'rgba(255, 213, 0, 0.4)';
          for (const raw of tc.items as Array<{ str?: string; transform?: number[]; width?: number }>) {
            if (!raw.str || !raw.transform) continue;
            const text = normText(raw.str);
            let idx = text.indexOf(hl);
            if (idx === -1) continue;
            const tx = pdfjsLib.Util.transform(viewport.transform, raw.transform);
            const fontH = Math.hypot(tx[2], tx[3]);
            const itemW = (raw.width ?? 0) * viewport.scale;
            while (idx !== -1) {
              const x = tx[4] + (idx / text.length) * itemW;
              const w = Math.max(4, (hl.length / text.length) * itemW);
              ctx.fillRect(x, tx[5] - fontH, w, fontH * 1.2);
              idx = text.indexOf(hl, idx + hl.length);
            }
          }
          ctx.restore();
        } catch { /* géométrie illisible — la page reste rendue sans surlignage */ }
      }
      canvas.dataset.k = key;
    } catch {
      /* RenderingCancelledException on fast zoom/scroll — expected, ignore */
    }
  }, [availWidth, zoom, hl]);

  // Lazy-render the pages entering the viewport (+ a margin so they're ready before you reach them),
  // and keep the "current page" indicator in sync with the most-visible page. Re-created when the
  // scale changes so the visible pages re-render at the new zoom.
  useEffect(() => {
    if (!loaded || !availWidth || !numPages) return;
    const root = containerRef.current;
    const ratios = new Map<number, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const page = Number((e.target as HTMLElement).dataset.page);
          ratios.set(page, e.isIntersecting ? e.intersectionRatio : 0);
          if (e.isIntersecting) void renderPage(page);
        }
        let best = 1;
        let bestRatio = -1;
        ratios.forEach((r, pg) => {
          if (r > bestRatio) { bestRatio = r; best = pg; }
        });
        setCurrentPage((prev) => (prev === best ? prev : best));
      },
      { root, rootMargin: '600px 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    wrapRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [loaded, availWidth, numPages, renderPage]);

  if (error) {
    return (
      <Box sx={s.wrapper}>
        <Box sx={s.center}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('document.pdfError')}</Typography>
          <Button variant="outlined" startIcon={<OpenInNew />} component="a" href={`/api/documents/${docId}/file`} target="_blank" rel="noopener">
            {t('document.openInTab')}
          </Button>
        </Box>
      </Box>
    );
  }

  const placeholderH = availWidth ? Math.round(availWidth * zoom * defaultAspect) : 480;

  // Hauteur du conteneur = UNE page entière au fit-width (zoom 1) + le padding vertical — demande
  // explicite (2026-07-07) : « la taille d'une page pdf ». Bornée pour rester raisonnable sur un
  // écran étroit (min) et face à un PDF paysage très allongé ou une colonne très large (max).
  const viewerHeight = availWidth
    ? Math.min(MAX_VIEWER_H, Math.max(MIN_VIEWER_H, Math.round(availWidth * defaultAspect) + 34))
    : undefined;

  return (
    <Box sx={s.wrapper}>
      <Box sx={s.toolbar}>
        <Typography variant="body2" className="mono" sx={s.pageLabel}>
          {loaded ? `${currentPage} / ${numPages}` : '—'}
        </Typography>

        {/* Recherche dans le document — zone visible, pas seulement Ctrl+F (demande 2026-07-08) */}
        <Box sx={s.searchBox}>
          <Search fontSize="small" sx={{ color: 'text.secondary' }} aria-hidden="true" />
          <InputBase
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              // Enter relance la recherche ; re-Enter sur la même requête = résultat suivant.
              if (normText(query.trim()) === hl && matchPages.length) gotoMatch(1);
              else void runSearch();
            }}
            placeholder={t('document.searchInPdf')}
            disabled={!loaded}
            sx={s.searchInput}
            inputProps={{ 'aria-label': t('document.searchInPdf') }}
          />
          {query && (
            <IconButton size="small" onClick={clearSearch} aria-label={t('document.searchClear')}>
              <Close fontSize="inherit" />
            </IconButton>
          )}
        </Box>
        {searching && <CircularProgress size={14} />}
        {!searching && totalHits != null && (
          <Typography variant="caption" color={totalHits === 0 ? 'text.secondary' : 'primary'} sx={{ whiteSpace: 'nowrap' }}>
            {totalHits === 0 ? t('document.searchNoHits') : t('document.searchHits', { count: totalHits })}
          </Typography>
        )}
        {matchPages.length > 0 && (
          <>
            <IconButton size="small" onClick={() => gotoMatch(-1)} aria-label={t('document.searchPrev')}>
              <KeyboardArrowUp fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => gotoMatch(1)} aria-label={t('document.searchNext')}>
              <KeyboardArrowDown fontSize="small" />
            </IconButton>
          </>
        )}

        <Box sx={{ flexGrow: 1 }} />
        <IconButton size="small" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))} disabled={!loaded || zoom <= MIN_ZOOM} aria-label={t('document.zoomOut')}>
          <ZoomOut />
        </IconButton>
        <Typography variant="body2" className="mono" sx={s.zoomLabel}>{Math.round(zoom * 100)}%</Typography>
        <IconButton size="small" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))} disabled={!loaded || zoom >= MAX_ZOOM} aria-label={t('document.zoomIn')}>
          <ZoomIn />
        </IconButton>
      </Box>

      <Box ref={containerRef} sx={s.canvasArea(viewerHeight)}>
        <Box ref={rulerRef} sx={{ width: '100%', height: 0 }} />
        {!loaded && <Box sx={s.center}><CircularProgress size={32} /></Box>}
        {loaded && (
          <Box sx={s.pagesCol}>
            {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
              <Box
                key={page}
                data-page={page}
                ref={(el: HTMLDivElement | null) => { wrapRefs.current[page - 1] = el; }}
                sx={{ ...s.pageBox, minHeight: placeholderH }}
              >
                <canvas
                  ref={(el) => { canvasRefs.current[page - 1] = el; }}
                  aria-label={t('document.pdfPageAria', { title, page })}
                  style={{ display: 'block' }}
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
