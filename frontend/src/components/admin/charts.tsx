import { Box, Typography, Link as MuiLink } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import GlassCard from '@/components/ui/GlassCard';
import { useChartColors } from './chartColors';

/**
 * Mini-bibliothèque de graphiques SVG du panel admin (pas de lib externe).
 * Specs (skill dataviz) : barres ≤ 24 px, bout de donnée arrondi 4 px + base carrée, écart 2 px,
 * texte en tokens (jamais la couleur de série), palettes validées par le validateur CVD/contraste :
 * dark #0095b3/#7b2ff7 sur #0a0e1a, light #0091b3/#6a1be0 sur #f0f4f8. L'identité « week-end »
 * est doublée d'une légende TEXTE (jamais la couleur seule).
 */
const nf = new Intl.NumberFormat('fr-BE');

/** Tuile KPI : valeur compacte + delta vs période précédente (▲ vert / ▼ rouge / — neutre). */
export function KpiTile({ label, value, previous, vsLabel }: {
  label: string;
  value: number;
  previous: number;
  vsLabel: string;
}) {
  let delta: { text: string; color: string } | null = null;
  if (previous > 0) {
    const pct = Math.round(((value - previous) / previous) * 100);
    delta = pct > 0
      ? { text: `▲ +${pct} %`, color: 'success.main' }
      : pct < 0
        ? { text: `▼ ${pct} %`, color: 'error.main' }
        : { text: '— stable', color: 'text.secondary' };
  } else if (value > 0) {
    delta = { text: '● nouveau', color: 'text.secondary' };
  }
  return (
    <GlassCard sx={{ p: 2, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
        {nf.format(value)}
      </Typography>
      <Typography variant="caption" className="mono" sx={{ color: delta?.color ?? 'text.secondary' }}>
        {delta ? `${delta.text} ${vsLabel}` : '—'}
      </Typography>
    </GlassCard>
  );
}

export interface DayPoint {
  day: string; // ISO yyyy-MM-dd
  count: number;
}

function isWeekend(iso: string): boolean {
  const d = new Date(iso + 'T12:00:00').getDay();
  return d === 0 || d === 6;
}

/** Chemin d'une barre : bout de donnée arrondi (4 px max), base carrée. */
function barPath(x: number, w: number, y: number, baseY: number): string {
  if (baseY - y < 1) return '';
  const r = Math.min(4, w / 2, baseY - y);
  return `M${x} ${baseY} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} L${x + w} ${baseY} Z`;
}

/**
 * Barres journalières (série unique — pas de légende, le titre du panneau nomme la série ;
 * week-ends dans la teinte secondaire, doublés par la légende texte du parent).
 * Tooltip natif par barre (<title>).
 */
export function DayBars({ data, height = 96, tooltip }: {
  data: DayPoint[];
  height?: number;
  /** Libellé du tooltip natif d'une barre (jour formaté + valeur). */
  tooltip: (point: DayPoint) => string;
}) {
  const colors = useChartColors();
  const n = data.length;
  if (n === 0) return null;
  const max = Math.max(1, ...data.map((p) => p.count));
  const gap = 2;
  // Largeur logique : slot borné pour que les barres restent ≤ 24 px après mise à l'échelle.
  const slot = Math.min(26, Math.max(6, Math.floor(560 / n)));
  const w = slot - gap;
  const width = n * slot;
  const baseY = height - 1;

  return (
    <Box component="svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
         sx={{ width: '100%', height, display: 'block' }} role="img">
      {/* Ligne de base — hairline récessive. */}
      <line x1="0" x2={width} y1={baseY} y2={baseY} stroke={colors.grid} strokeWidth="1" />
      {data.map((p, i) => {
        const h = Math.round((p.count / max) * (height - 10));
        const y = baseY - h;
        return (
          <path key={p.day} d={barPath(i * slot + gap / 2, w, y, baseY)}
                fill={isWeekend(p.day) ? colors.accent : colors.bar}>
            <title>{tooltip(p)}</title>
          </path>
        );
      })}
    </Box>
  );
}

/** Barres horizontales de répartition — une seule teinte, l'identité vit dans le libellé. */
export function HBarList({ rows, emptyLabel }: {
  rows: { label: string; count: number }[];
  emptyLabel: string;
}) {
  const colors = useChartColors();
  if (rows.length === 0) {
    return <Typography variant="caption" color="text.secondary">{emptyLabel}</Typography>;
  }
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {rows.map((r) => (
        <Box key={r.label} sx={{ display: 'grid', gridTemplateColumns: '110px 1fr 48px', gap: 1, alignItems: 'center' }}>
          <Typography variant="caption" noWrap title={r.label}>{r.label}</Typography>
          <Box sx={{ height: 10, borderRadius: '0 4px 4px 0', bgcolor: colors.bar,
                     width: `${Math.max(2, (r.count / max) * 100)}%` }} />
          <Typography variant="caption" className="mono" sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {nf.format(r.count)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/** Liste « top contenus » : rang discret, libellé (lien interne quand `to` est fourni — un top
 *  qu'on ne peut pas ouvrir est frustrant), valeur alignée (tabular-nums). */
export function TopList({ rows, emptyLabel }: {
  rows: { label: string; count: number; to?: string }[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <Typography variant="caption" color="text.secondary">{emptyLabel}</Typography>;
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {rows.map((r, i) => (
        <Box key={`${r.label}-${i}`} sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="caption" color="text.secondary" className="mono" sx={{ width: 16 }}>
            {i + 1}
          </Typography>
          {r.to ? (
            <MuiLink
              component={RouterLink}
              to={r.to}
              variant="body2"
              noWrap
              title={r.label}
              underline="hover"
              color="inherit"
              sx={{ flex: 1, minWidth: 0, '&:hover': { color: 'primary.main' } }}
            >
              {r.label}
            </MuiLink>
          ) : (
            <Typography variant="body2" noWrap title={r.label} sx={{ flex: 1, minWidth: 0 }}>
              {r.label}
            </Typography>
          )}
          <Typography variant="body2" className="mono" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {nf.format(r.count)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
