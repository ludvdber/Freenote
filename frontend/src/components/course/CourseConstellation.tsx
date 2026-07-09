import { Box, useTheme } from '@mui/material';

interface StarDoc {
  id: number;
  title: string;
  downloadCount: number;
}

const W = 340;
const H = 150;

// djb2 sur l'id → jitter déterministe : l'ornement est stable d'un rendu (et d'une visite) à l'autre.
function jitter(id: number, salt: number, range: number): number {
  let h = (5381 ^ salt) >>> 0;
  const str = String(id);
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return (h % (2 * range + 1)) - range;
}

/**
 * Ornement de données du bandeau page cours (maquette « Cartographie du savoir ») : une étoile
 * par document (8 max), rayon et halo proportionnels aux vues. Décoratif pur (aria-hidden),
 * statique, masqué sous md — rien à voir avec la SectionConstellation du hero (rejetée) :
 * ici c'est un petit graphique en coin de bandeau, jamais un fond de page.
 */
export default function CourseConstellation({ docs }: { docs: StarDoc[] }) {
  const dark = useTheme().palette.mode === 'dark';
  const stars = docs.slice(0, 8);
  if (stars.length === 0) return null;

  const maxViews = Math.max(1, ...stars.map((d) => d.downloadCount));
  const pts = stars.map((d, i) => {
    const x = stars.length === 1 ? W / 2 : 30 + ((W - 60) * i) / (stars.length - 1) + jitter(d.id, 7, 12);
    const y = 45 + jitter(d.id, 13, 32) + 32; // 45..109
    const ratio = d.downloadCount / maxViews;
    return { x, y, ratio, r: 3 + 3.5 * Math.sqrt(ratio) };
  });

  const lineCyan = dark ? 'rgba(0,212,255,0.30)' : 'rgba(0,145,179,0.35)';
  const lineViolet = dark ? 'rgba(123,47,247,0.35)' : 'rgba(106,27,224,0.35)';
  const coreFill = (ratio: number) =>
    dark
      ? ratio > 0.66 ? '#ffffff' : ratio > 0.33 ? '#bfeaff' : 'rgba(255,255,255,0.45)'
      : ratio > 0.66 ? '#1e2948' : ratio > 0.33 ? '#0091b3' : 'rgba(30,41,72,0.45)';
  const haloFill = (ratio: number) =>
    dark ? `rgba(0,212,255,${0.10 + 0.12 * ratio})` : `rgba(0,145,179,${0.08 + 0.10 * ratio})`;

  return (
    <Box
      component="svg"
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
      sx={{
        position: 'absolute',
        right: 22,
        top: 14,
        width: W,
        height: H,
        opacity: 0.9,
        display: { xs: 'none', md: 'block' },
        pointerEvents: 'none',
      }}
    >
      {pts.slice(1).map((p, i) => (
        <line
          key={i}
          x1={pts[i].x}
          y1={pts[i].y}
          x2={p.x}
          y2={p.y}
          stroke={i < pts.length / 2 ? lineCyan : lineViolet}
        />
      ))}
      {pts.map((p, i) => (
        <g key={stars[i].id}>
          <circle cx={p.x} cy={p.y} r={p.r * 2.3} fill={haloFill(p.ratio)} />
          <circle cx={p.x} cy={p.y} r={p.r} fill={coreFill(p.ratio)} />
        </g>
      ))}
    </Box>
  );
}
