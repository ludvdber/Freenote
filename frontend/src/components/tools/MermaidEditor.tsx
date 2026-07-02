import { useEffect, useRef, useState } from 'react';
import { Box, Typography, TextField, Button, Stack, Alert } from '@mui/material';
import { FileDownload, Image as ImageIcon, ContentCopy } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import GlassCard from '@/components/ui/GlassCard';

/** Starter snippets — the editor is generic but these cover the common UML/diagram kinds. */
const TEMPLATES: { key: string; code: string }[] = [
  {
    key: 'class',
    code: `classDiagram
    class Animal {
        +String nom
        +int age
        +manger()
    }
    class Chien {
        +aboyer()
    }
    Animal <|-- Chien`,
  },
  {
    key: 'sequence',
    code: `sequenceDiagram
    participant Client
    participant Serveur
    Client->>Serveur: Requête
    Serveur-->>Client: Réponse`,
  },
  {
    key: 'flow',
    code: `flowchart TD
    A[Début] --> B{Condition ?}
    B -- Oui --> C[Action 1]
    B -- Non --> D[Action 2]
    C --> E[Fin]
    D --> E`,
  },
  {
    key: 'er',
    code: `erDiagram
    ETUDIANT ||--o{ INSCRIPTION : possède
    COURS ||--o{ INSCRIPTION : concerne
    ETUDIANT {
        int id
        string nom
    }`,
  },
  {
    key: 'state',
    code: `stateDiagram-v2
    [*] --> Brouillon
    Brouillon --> Publié : publier
    Publié --> Archivé : archiver
    Archivé --> [*]`,
  },
  {
    key: 'gantt',
    code: `gantt
    title Planning de projet
    dateFormat YYYY-MM-DD
    section Analyse
    Cahier des charges :a1, 2026-09-01, 7d
    section Développement
    Backend :after a1, 14d`,
  },
];

let renderSeq = 0;

export default function MermaidEditor() {
  const { t } = useTranslation();
  const [code, setCode] = useState(TEMPLATES[0].code);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
        const { svg: out } = await mermaid.render(`mmd-${++renderSeq}`, code);
        if (!cancelled) { setSvg(out); setError(''); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'parse error');
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [code]);

  const downloadSvg = () => {
    triggerDownload(new Blob([svg], { type: 'image/svg+xml' }), 'diagramme.svg');
  };

  const downloadPng = () => {
    const svgEl = previewRef.current?.querySelector('svg');
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const scale = 2;
    const data = new XMLSerializer().serializeToString(svgEl);
    const img = new Image();
    const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml' }));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => { if (blob) triggerDownload(blob, 'diagramme.png'); });
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  const copyCode = () => { navigator.clipboard?.writeText(code).catch(() => {}); };

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        {TEMPLATES.map((tpl) => (
          <Button key={tpl.key} size="small" variant="outlined" onClick={() => setCode(tpl.code)}>
            {t(`tools.mermaid.tpl.${tpl.key}`)}
          </Button>
        ))}
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <TextField
          value={code}
          onChange={(e) => setCode(e.target.value)}
          fullWidth multiline minRows={14}
          label={t('tools.mermaid.codeLabel')}
          slotProps={{ htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace', fontSize: 13 } } }}
        />

        <GlassCard sx={{ p: 2, minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
          {svg
            ? <Box ref={previewRef} sx={{ width: '100%', '& svg': { maxWidth: '100%', height: 'auto' } }} dangerouslySetInnerHTML={{ __html: svg }} />
            : <Typography color="text.secondary" variant="body2">{t('tools.mermaid.previewEmpty')}</Typography>}
        </GlassCard>
      </Box>

      {error && <Alert severity="warning" sx={{ mt: 2 }}>{t('tools.mermaid.syntaxError')}: {error}</Alert>}

      <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button size="small" startIcon={<FileDownload />} onClick={downloadSvg} disabled={!svg}>{t('tools.mermaid.exportSvg')}</Button>
        <Button size="small" startIcon={<ImageIcon />} onClick={downloadPng} disabled={!svg}>{t('tools.mermaid.exportPng')}</Button>
        <Button size="small" startIcon={<ContentCopy />} onClick={copyCode}>{t('tools.mermaid.copyCode')}</Button>
      </Stack>
    </Box>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
