import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, IconButton, Typography, CircularProgress, Button } from '@mui/material';
import { NavigateBefore, NavigateNext, ZoomIn, ZoomOut, OpenInNew } from '@mui/icons-material';
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
 * Renders an authenticated PDF to a <canvas> with pdf.js — works inline on every device, including
 * mobile browsers that refuse to display a PDF inside an <iframe> (the old approach). The bytes are
 * fetched through the same authenticated endpoint (cookie-based), so nothing is exposed publicly.
 * One page is rendered at a time (bounded memory) with page navigation + zoom.
 */
export default function PdfViewer({ docId, title }: { docId: number; title: string }) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [error, setError] = useState(false);

  // Reset to the loading state when the document changes (the component stays mounted when navigating
  // between docs). Adjusting state during render — React's recommended pattern — keeps it out of an
  // effect (avoids the set-state-in-effect lint rule), same as DocumentView does for favStatus.
  const [prevDocId, setPrevDocId] = useState(docId);
  if (docId !== prevDocId) {
    setPrevDocId(docId);
    setPdf(null);
    setError(false);
    setNumPages(0);
    setPageNum(1);
    setZoom(1);
  }

  // Load the document once, fetching bytes through the authenticated endpoint.
  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
    (async () => {
      try {
        const blob = await downloadDocument(docId);
        const data = await blob.arrayBuffer();
        if (cancelled) return;
        loadingTask = pdfjsLib.getDocument({ data });
        const loaded = await loadingTask.promise;
        if (cancelled) { loadingTask.destroy(); return; }
        setPdf(loaded);
        setNumPages(loaded.numPages);
        setPageNum(1);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      loadingTask?.destroy(); // frees the document + worker resources
    };
  }, [docId]);

  // Track the container width so the page fits horizontally (and re-fits on rotate/resize).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pdf]);

  // Render the current page whenever it, the zoom or the available width changes.
  useEffect(() => {
    if (!pdf || !width || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(pageNum);
      if (cancelled) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (width / base.width) * zoom });

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      renderTaskRef.current?.cancel(); // a pending render on this canvas would throw otherwise
      const task = page.render({
        canvas,
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch {
        /* RenderingCancelledException when navigating fast — expected, ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [pdf, pageNum, zoom, width]);

  const go = useCallback((delta: number) => {
    setPageNum((p) => Math.min(Math.max(1, p + delta), numPages));
  }, [numPages]);

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

  return (
    <Box sx={s.wrapper}>
      <Box sx={s.toolbar}>
        <IconButton size="small" onClick={() => go(-1)} disabled={!pdf || pageNum <= 1} aria-label={t('document.prevPage')}>
          <NavigateBefore />
        </IconButton>
        <Typography variant="body2" className="mono" sx={s.pageLabel}>
          {pdf ? `${pageNum} / ${numPages}` : '—'}
        </Typography>
        <IconButton size="small" onClick={() => go(1)} disabled={!pdf || pageNum >= numPages} aria-label={t('document.nextPage')}>
          <NavigateNext />
        </IconButton>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton size="small" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))} disabled={!pdf || zoom <= MIN_ZOOM} aria-label={t('document.zoomOut')}>
          <ZoomOut />
        </IconButton>
        <Typography variant="body2" className="mono" sx={s.zoomLabel}>{Math.round(zoom * 100)}%</Typography>
        <IconButton size="small" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))} disabled={!pdf || zoom >= MAX_ZOOM} aria-label={t('document.zoomIn')}>
          <ZoomIn />
        </IconButton>
      </Box>

      <Box ref={containerRef} sx={s.canvasArea}>
        {!pdf && <Box sx={s.center}><CircularProgress size={32} /></Box>}
        <canvas
          ref={canvasRef}
          aria-label={t('document.pdfPageAria', { title, page: pageNum })}
          style={{ display: pdf ? 'block' : 'none', margin: '0 auto', maxWidth: '100%' }}
        />
      </Box>
    </Box>
  );
}
