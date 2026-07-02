import { useEffect, useState } from 'react';
import { Box } from '@mui/material';

/**
 * Renders a code snippet with syntax highlighting. highlight.js (+ its theme) is dynamically imported
 * so it only loads when a quiz actually contains code. The highlighter HTML-escapes the source, so
 * feeding its output to dangerouslySetInnerHTML is safe (no injection from the snippet content).
 */
export default function CodeBlock({ code, language }: { code: string; language?: string | null }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hljs = (await import('highlight.js/lib/common')).default;
      await import('highlight.js/styles/github-dark.css');
      const out = language && hljs.getLanguage(language)
        ? hljs.highlight(code, { language })
        : hljs.highlightAuto(code);
      if (!cancelled) setHtml(out.value);
    })();
    return () => { cancelled = true; };
  }, [code, language]);

  return (
    <Box
      component="pre"
      sx={{
        m: 0, p: 1.5, borderRadius: 2, overflow: 'auto',
        bgcolor: '#0d1117', color: '#c9d1d9',
        fontSize: 13.5, lineHeight: 1.55, fontFamily: '"JetBrains Mono", monospace',
        '& code': { fontFamily: 'inherit', background: 'none', p: 0 },
      }}
    >
      {html
        ? <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
        : <code>{code}</code>}
    </Box>
  );
}
