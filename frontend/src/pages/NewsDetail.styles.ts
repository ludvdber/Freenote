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

// Editorial header sits on the cosmic background (outside the glass card) so the title pops.
export const header: Sx = { mb: { xs: 3, md: 4 }, px: { xs: 0.5, md: 0 } };

export const eyebrow: Sx = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 1.25,
  mb: 2,
};

export const chip: Sx = {
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontSize: '0.68rem',
  height: 22,
  color: 'primary.main',
  borderColor: 'rgba(0, 210, 255, 0.4)',
  backgroundColor: 'rgba(0, 210, 255, 0.06)',
};

export const dot: Sx = {
  width: 3,
  height: 3,
  borderRadius: '50%',
  bgcolor: 'text.disabled',
  flexShrink: 0,
};

export const meta: Sx = { color: 'text.secondary', fontWeight: 600, fontSize: '0.875rem' };

export const title: Sx = {
  fontWeight: 800,
  fontSize: { xs: '1.85rem', sm: '2.2rem', md: '2.6rem' },
  lineHeight: 1.12,
  letterSpacing: '-0.02em',
  color: 'text.primary',
  mb: 2.5,
};

export const accentBar: Sx = {
  width: 64,
  height: 4,
  borderRadius: 2,
  background: TOKENS.gradients.primaryBar,
};

export const grid = (withSidebar: boolean): Sx => ({
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: withSidebar ? 'minmax(0, 1fr) 300px' : '1fr' },
  gap: { xs: 3, md: 4 },
  alignItems: 'start',
  // No ad rail (Ko-fi supporters): keep the lone article at a comfortable reading measure.
  ...(withSidebar ? {} : { maxWidth: 820, mx: 'auto' }),
});

export const articleCard: Sx = {
  p: { xs: 2.5, md: 5 },
  // GlassCard lifts/glows on hover — undesirable for a static reading surface.
  '&:hover': { transform: 'none', boxShadow: 'none' },
};

// Typographic reset + rhythm for the sanitized third-party blog HTML.
export const prose: Sx = {
  color: 'text.primary',
  fontSize: { xs: '1rem', md: '1.0625rem' },
  lineHeight: 1.8,
  wordBreak: 'break-word',
  // The school's inline `color:#000` / white backgrounds would render as invisible text on our
  // dark glass — force-inherit color/background on everything except links (which keep their cyan).
  '& *:not(a):not(code)': { color: 'inherit !important', backgroundColor: 'transparent !important' },
  '& > :first-of-type': { mt: 0 },
  '& > :last-child': { mb: 0 },
  '& p': { my: 2 },
  '& h1, & h2, & h3, & h4, & h5': { fontWeight: 700, lineHeight: 1.25, mt: 3.5, mb: 1.5 },
  '& h1, & h2': { fontSize: { xs: '1.3rem', md: '1.5rem' } },
  '& h3, & h4, & h5': { fontSize: { xs: '1.12rem', md: '1.22rem' } },
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
  '& img': {
    display: 'block',
    maxWidth: '100%',
    height: 'auto',
    borderRadius: 2,
    my: 3,
    mx: 'auto',
    border: (t) => `1px solid ${t.palette.divider}`,
  },
  '& a img': { border: 'none' },
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
  '& iframe': { maxWidth: '100%', borderRadius: 2, my: 2 },
};

export const divider: Sx = { my: { xs: 3, md: 4 } };

export const sourceBtn: Sx = {
  borderColor: 'rgba(0, 210, 255, 0.4)',
  color: 'primary.main',
  fontWeight: 600,
  '&:hover': { borderColor: 'primary.main', backgroundColor: 'rgba(0, 210, 255, 0.06)' },
};

export const sidebar: Sx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  position: { md: 'sticky' },
  top: { md: 88 }, // navbar offset — the money slot stays in view while scrolling
};
