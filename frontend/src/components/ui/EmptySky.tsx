import { Box, useTheme } from '@mui/material';
import * as s from './EmptySky.styles';

/**
 * Petits visuels « ciel » partagés par les empty states (404, recherche vide, notifications).
 * Tous décoratifs (aria-hidden) — le texte de l'état vide reste la seule information.
 */

function useDark() {
  return useTheme().palette.mode === 'dark';
}

/** Étoile filante — le parent doit être position: relative + overflow: hidden. */
export function ShootingStar() {
  return <Box aria-hidden="true" sx={s.shootingStar(useDark())} />;
}

/** Anneau orbital elliptique — le parent doit être position: relative. */
export function OrbitRing() {
  return <Box aria-hidden="true" sx={s.orbitRing(useDark())} />;
}

/** Viseur de télescope vide (recherche sans résultat). Bloc autonome de 86 px de haut. */
export function TelescopeSky() {
  return (
    <Box aria-hidden="true" sx={s.telescopeSky}>
      <Box sx={s.quadrantFrame(useDark())} />
    </Box>
  );
}

/** Lune endormie (aucune notification). Bloc autonome de 72 px de haut. */
export function SleepyMoon() {
  const dark = useDark();
  return (
    <Box aria-hidden="true" sx={s.moonSky}>
      <Box sx={s.moon(dark)} />
      <Box component="span" sx={s.moonZz}>z z</Box>
    </Box>
  );
}
