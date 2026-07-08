import type { SxProps, Theme } from '@mui/material';
import { TOKENS } from '@/theme/tokens';

type Sx = SxProps<Theme>;

export const article: Sx = { maxWidth: 1120, mx: 'auto' };

export const backBtn: Sx = {
  mb: { xs: 1.5, md: 2.5 },
  color: 'text.secondary',
  fontWeight: 600,
  '&:hover': { color: 'primary.main', backgroundColor: 'transparent' },
};

export const header: Sx = { mb: { xs: 3, md: 4 }, px: { xs: 0.5, md: 0 } };

export const eyebrow: Sx = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25, mb: 2 };

// Teinte dérivée de la catégorie (lib/guideCover) — même accent que la couverture de l'index.
export const chip = (color: string): Sx => ({
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontSize: '0.68rem',
  height: 22,
  color,
  borderColor: `${color}66`,
  backgroundColor: `${color}0f`,
});

export const dot: Sx = { width: 3, height: 3, borderRadius: '50%', bgcolor: 'text.disabled', flexShrink: 0 };

export const meta: Sx = { color: 'text.secondary', fontWeight: 600, fontSize: '0.875rem' };

export const title: Sx = {
  fontWeight: 800,
  fontSize: { xs: '1.85rem', sm: '2.2rem', md: '2.6rem' },
  lineHeight: 1.12,
  letterSpacing: '-0.02em',
  color: 'text.primary',
  mb: 2.5,
};

export const accentBar: Sx = { width: 64, height: 4, borderRadius: 2, background: TOKENS.gradients.primaryBar };

export const grid = (withSidebar: boolean): Sx => ({
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: withSidebar ? 'minmax(0, 1fr) 300px' : '1fr' },
  gap: { xs: 3, md: 4 },
  alignItems: 'start',
  ...(withSidebar ? {} : { maxWidth: 820, mx: 'auto' }),
});

export const articleCard: Sx = {
  p: { xs: 2.5, md: 5 },
  '&:hover': { transform: 'none', boxShadow: 'none' },
};

// Typographic rhythm for our own (admin-authored) Markdown, with code-block styling.
export const prose: Sx = {
  color: 'text.primary',
  fontSize: { xs: '1rem', md: '1.0625rem' },
  lineHeight: 1.8,
  wordBreak: 'break-word',
  '& > :first-of-type': { mt: 0 },
  '& > :last-child': { mb: 0 },
  '& p': { my: 2 },
  '& h1, & h2, & h3, & h4, & h5': { fontWeight: 700, lineHeight: 1.25, mt: 3.5, mb: 1.5 },
  '& h1, & h2': { fontSize: { xs: '1.4rem', md: '1.7rem' } },
  '& h3, & h4, & h5': { fontSize: { xs: '1.12rem', md: '1.25rem' } },
  '& ul, & ol': { pl: 3, my: 2 },
  '& li': { mb: 0.75 },
  '& strong, & b': { fontWeight: 700 },
  '& a': {
    color: 'primary.main',
    fontWeight: 600,
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    '&:hover': { textDecoration: 'none' },
  },
  // Inline code
  '& code': {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '0.875em',
    px: 0.6,
    py: 0.2,
    borderRadius: 1,
    bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
  },
  // Code blocks (highlight.js github-dark theme paints the inside)
  '& pre': {
    my: 2.5,
    p: 2,
    borderRadius: 2,
    overflow: 'auto',
    bgcolor: '#0d1117',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  '& pre code': {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '0.85rem',
    lineHeight: 1.6,
    bgcolor: 'transparent',
    p: 0,
    color: '#c9d1d9',
  },
  '& img': {
    display: 'block',
    maxWidth: '100%',
    height: 'auto',
    borderRadius: 2,
    my: 3,
    mx: 'auto',
    border: (t) => `1px solid ${t.palette.divider}`,
  },
  '& blockquote': {
    borderLeft: '3px solid',
    borderColor: 'primary.main',
    pl: 2.5,
    ml: 0,
    my: 3,
    fontStyle: 'italic',
    color: 'text.secondary',
  },
  '& hr': { border: 'none', borderTop: (t) => `1px solid ${t.palette.divider}`, my: 4 },
  '& table': { width: '100%', borderCollapse: 'collapse', my: 3, fontSize: '0.95em' },
  '& td, & th': { border: (t) => `1px solid ${t.palette.divider}`, p: 1, textAlign: 'left' },
};

export const sidebar: Sx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  position: { md: 'sticky' },
  top: { md: 88 },
};

// ——— Sommaire du guide (rail) — h2/h3 du Markdown, même grammaire que l'outline PDF. ———

export const tocCard: Sx = { p: 2.5 };

export const tocList = (scrollable: boolean): Sx => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 0.25,
  ...(scrollable ? { maxHeight: 320, overflowY: 'auto', pr: 0.5 } : {}),
});

export const tocEntry = (level: number): Sx => ({
  display: 'block',
  width: '100%',
  textAlign: 'left',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  borderRadius: 1,
  px: 1,
  py: 0.5,
  pl: level === 0 ? 1 : 2.5,
  fontSize: '0.82rem',
  fontWeight: level === 0 ? 600 : 400,
  color: level === 0 ? 'text.primary' : 'text.secondary',
  fontFamily: 'inherit',
  lineHeight: 1.4,
  '&:hover': {
    color: 'primary.main',
    backgroundColor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
  },
});

// ——— Encart « Pratique avec l'outil » (rail) — rendu uniquement si le guide a un outil lié. ———

export const toolCard: Sx = { p: 2.5 };

export const toolOverline: Sx = {
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: 11,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: 'text.secondary',
  mb: 1,
};

export const toolName: Sx = { fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.3 };
