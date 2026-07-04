import { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, TextField, Button, Stack, Alert,
  Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import { FileDownload, Image as ImageIcon, ContentCopy, ExpandMore, PlayArrow } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import GlassCard from '@/components/ui/GlassCard';

interface GuideEntry {
  title: string;
  text: string;
  code?: string;
}

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
];

let renderSeq = 0;

export default function MermaidEditor() {
  const { t } = useTranslation();
  const guideRaw = t('tools.mermaid.guide', { returnObjects: true });
  const guide: GuideEntry[] = Array.isArray(guideRaw) ? (guideRaw as GuideEntry[]) : [];
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

      {/* Guide syntaxe intégré : comment écrire du Mermaid, par type de diagramme. Chaque
          section a un extrait « Essayer » qui remplit l'éditeur au-dessus. */}
      {guide.length > 0 && (
        <Box component="section" sx={{ mt: 4 }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 0.5 }}>
            {t('tools.mermaid.guideTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t('tools.mermaid.guideIntro')}
          </Typography>
          {guide.map((g, i) => (
            <Accordion key={i} disableGutters elevation={0} sx={{ bgcolor: 'transparent' }}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography component="h3" sx={{ fontWeight: 600, fontSize: '0.95rem' }}>{g.title}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: g.code ? 1.5 : 0 }}>
                  {g.text}
                </Typography>
                {g.code && (
                  <>
                    <Box component="pre" sx={{
                      m: 0, p: 1.5, borderRadius: 1.5, overflowX: 'auto',
                      fontFamily: '"JetBrains Mono", monospace', fontSize: 12.5, lineHeight: 1.6,
                      bgcolor: (th) => th.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    }}>{g.code}</Box>
                    <Button size="small" startIcon={<PlayArrow />} sx={{ mt: 1 }}
                      onClick={() => { setCode(g.code!); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                      {t('tools.mermaid.tryIt')}
                    </Button>
                  </>
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
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
