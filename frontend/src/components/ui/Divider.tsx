import { Box, useTheme } from '@mui/material';

/**
 * Divider constellation (maquette « Poussière d'étoile » validée 2026-07-09) : la ligne
 * s'interrompt sur une petite constellation de 5 étoiles. Décoratif pur (aria-hidden),
 * statique (reduced-motion-safe par nature), couleurs de MARQUE (pas l'accent supporter).
 */
export default function Divider() {
  const dark = useTheme().palette.mode === 'dark';
  const line = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const linkCyan = dark ? 'rgba(0,212,255,0.35)' : 'rgba(0,145,179,0.4)';
  const linkViolet = dark ? 'rgba(123,47,247,0.45)' : 'rgba(106,27,224,0.4)';
  const starCyan = dark ? '#7dd8ff' : '#0091b3';
  const starViolet = dark ? '#c9a8ff' : '#6a1be0';
  const starBright = dark ? '#e8ecf4' : '#1e2948';

  return (
    <Box aria-hidden="true" sx={{ display: 'flex', alignItems: 'center', height: 22, mx: { xs: 2, md: '60px' } }}>
      <Box sx={{ flex: 1, height: '1px', background: `linear-gradient(90deg, transparent, ${line})` }} />
      <Box component="svg" viewBox="0 0 150 22" sx={{ width: 150, height: 22, flexShrink: 0, mx: 1 }}>
        <line x1="5" y1="11" x2="37" y2="5" stroke={linkCyan} strokeWidth="1" />
        <line x1="37" y1="5" x2="75" y2="14" stroke={linkCyan} strokeWidth="1" />
        <line x1="75" y1="14" x2="115" y2="7" stroke={linkViolet} strokeWidth="1" />
        <line x1="115" y1="7" x2="145" y2="11" stroke={linkViolet} strokeWidth="1" />
        <circle cx="5" cy="11" r="2" fill={starCyan} />
        <circle cx="37" cy="5" r="2.6" fill={starBright} />
        <circle cx="75" cy="14" r="2" fill={starCyan} />
        <circle cx="115" cy="7" r="2.6" fill={starViolet} />
        <circle cx="145" cy="11" r="2" fill={starViolet} />
      </Box>
      <Box sx={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${line}, transparent)` }} />
    </Box>
  );
}
