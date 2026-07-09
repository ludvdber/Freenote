import { useTheme } from '@mui/material/styles';

/**
 * Couleurs des graphiques admin — palettes VALIDÉES par le validateur du skill dataviz
 * (bande de luminosité OKLCH, chroma, séparation CVD, contraste ≥ 3:1) :
 * dark #0095b3/#7b2ff7 sur surface #0a0e1a, light #0091b3/#6a1be0 sur #f0f4f8.
 * `accent` ne sert qu'aux week-ends des barres journalières, toujours doublé d'une légende texte.
 */
export function useChartColors() {
  const theme = useTheme();
  return theme.palette.mode === 'dark'
    ? { bar: '#0095b3', accent: '#7b2ff7', grid: 'rgba(255,255,255,0.12)' }
    : { bar: '#0091b3', accent: '#6a1be0', grid: 'rgba(0,0,0,0.12)' };
}
