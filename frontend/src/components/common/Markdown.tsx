import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { injectHeadingIds, type TocEntry } from '@/lib/toc';

marked.setOptions({ gfm: true, breaks: false });

/**
 * Renders Markdown to sanitised HTML. The pipeline is marked → DOMPurify → DOM, so even though guide
 * content is admin-authored (trusted), nothing unsanitised ever reaches the DOM (defence in depth).
 * Code fences are syntax-highlighted with highlight.js, which is **lazy-imported** (like the Quiz
 * CodeBlock) so it only loads for guides that actually contain code.
 *
 * `onToc` (optionnel) : reçoit le sommaire (h2/h3, ids injectés APRÈS sanitisation) — alimente la
 * carte « Sommaire » du rail de GuideDetail, même grammaire que l'outline PDF. Latest-ref : son
 * identité ne re-déclenche pas le parsing.
 */
export default function Markdown({ content, sx, onToc }: {
  content: string; sx?: SxProps<Theme>; onToc?: (toc: TocEntry[]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState('');

  const onTocRef = useRef(onToc);
  useEffect(() => { onTocRef.current = onToc; }, [onToc]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await marked.parse(content);
      let clean = DOMPurify.sanitize(raw);
      if (onTocRef.current) {
        const withIds = injectHeadingIds(clean);
        clean = withIds.html;
        if (!cancelled) onTocRef.current(withIds.toc);
      }
      if (!cancelled) setHtml(clean);
    })();
    return () => { cancelled = true; };
  }, [content]);

  useEffect(() => {
    const root = ref.current;
    if (!html || !root) return;
    const blocks = root.querySelectorAll('pre code');
    if (blocks.length === 0) return;
    let cancelled = false;
    (async () => {
      const hljs = (await import('highlight.js/lib/common')).default;
      await import('highlight.js/styles/github-dark.css');
      if (cancelled) return;
      blocks.forEach((b) => hljs.highlightElement(b as HTMLElement));
    })();
    return () => { cancelled = true; };
  }, [html]);

  return <Box ref={ref} sx={sx} dangerouslySetInnerHTML={{ __html: html }} />;
}
