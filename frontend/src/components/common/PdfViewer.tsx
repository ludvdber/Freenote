import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, IconButton, Typography, CircularProgress, Button } from '@mui/material';
import { ZoomIn, ZoomOut, OpenInNew } from '@mui/icons-material';
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
export default function PdfViewer({ docId, title }: { docId: number; title: string }) {
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
    // The ref arrays are NOT reset here (writing a ref during render is disallowed): setting numPages
    // to 0 unmounts the old pages, whose ref callbacks null out their slots, and the load effect's
    // cleanup cancels any in-flight render tasks.
  }

  // Load the document once, fetching bytes through the authenticated endpoint.
  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
    const tasks = renderTasks.current; // stable array instance — safe to reference in cleanup
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

  // Available width for fit-to-width — measured on a width:100% ruler so it stays the *visible* inner
  // width even when a zoomed page overflows and makes the scroll container wider than the viewport.
  useEffect(() => {
    const el = rulerRef.current;
    if (!el) return;
    const update = () => setAvailWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loaded]);

  // Render a single page into its canvas at the current fit-width × zoom. Idempotent per scale via a
  // data-attr key, so an already-rendered page is skipped until the zoom/width actually changes.
  const renderPage = useCallback(async (page: number) => {
    const pdf = pdfRef.current;
    const canvas = canvasRefs.current[page - 1];
    if (!pdf || !canvas || !availWidth) return;
    const key = `${availWidth}:${zoom}`;
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
      canvas.dataset.k = key;
    } catch {
      /* RenderingCancelledException on fast zoom/scroll — expected, ignore */
    }
  }, [availWidth, zoom]);

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

  return (
    <Box sx={s.wrapper}>
      <Box sx={s.toolbar}>
        <Typography variant="body2" className="mono" sx={s.pageLabel}>
          {loaded ? `${currentPage} / ${numPages}` : '—'}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton size="small" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))} disabled={!loaded || zoom <= MIN_ZOOM} aria-label={t('document.zoomOut')}>
          <ZoomOut />
        </IconButton>
        <Typography variant="body2" className="mono" sx={s.zoomLabel}>{Math.round(zoom * 100)}%</Typography>
        <IconButton size="small" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))} disabled={!loaded || zoom >= MAX_ZOOM} aria-label={t('document.zoomIn')}>
          <ZoomIn />
        </IconButton>
      </Box>

      <Box ref={containerRef} sx={s.canvasArea}>
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
