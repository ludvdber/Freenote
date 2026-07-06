import { Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { getStats } from '@/api/endpoints';
import * as s from './SectionConstellation.styles';

/**
 * La constellation des sections — l'« objet » du hero. Chaque étoile est une vraie section
 * ISFCE ; sa taille et sa pulsation reflètent l'activité réelle (docs par section, exposée
 * par GET /api/stats, permitAll + cache Redis). La promesse du produit rendue visible :
 * « chaque doc partagé allume une étoile ». Purement décorative (aria-hidden, pointerEvents
 * none) — les CTA restent cliquables à travers. Desktop seulement (masquée < md).
 */

// viewBox du dessin — ratio fixe pour que les cercles restent des cercles.
const VB_W = 1100;
const VB_H = 260;

// Tracé fixe et esthétique (coordonnées % du viewBox) pour 7 étoiles max — les DONNÉES pilotent
// la taille/pulsation, pas la position, pour garder un dessin stable et maîtrisé.
const STAR_POSITIONS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 8, y: 52 },
  { x: 21, y: 26 },
  { x: 37, y: 44 },
  { x: 51, y: 16 },
  { x: 65, y: 38 },
  { x: 80, y: 22 },
  { x: 92, y: 48 },
];

const px = (p: { x: number; y: number }) => ({ x: (p.x / 100) * VB_W, y: (p.y / 100) * VB_H });

export default function SectionConstellation() {
  // Même queryKey que StatsSection plus bas : une seule requête nourrit les deux.
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: getStats });
  const sections = (stats?.sections ?? []).slice(0, STAR_POSITIONS.length);
  if (sections.length < 2) return null;

  const maxCount = Math.max(1, ...sections.map((sec) => sec.documentCount));

  return (
    <Box aria-hidden="true" sx={s.wrapper}>
      <Box component="svg" viewBox={`0 0 ${VB_W} ${VB_H}`} sx={s.svg}>
        {/* Lignes reliant les étoiles consécutives. */}
        {sections.slice(0, -1).map((_, i) => {
          const a = px(STAR_POSITIONS[i]);
          const b = px(STAR_POSITIONS[i + 1]);
          return (
            <Box key={`line-${i}`} component="line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} sx={s.constellationLine} />
          );
        })}
        {sections.map((sec, i) => {
          const share = sec.documentCount / maxCount;
          const c = px(STAR_POSITIONS[i]);
          return (
            <g key={sec.name}>
              {/* Halo pulsant — cadence et taille suivent l'activité de la section. */}
              <Box component="circle" cx={c.x} cy={c.y} r={16 + share * 26} sx={s.starHalo(i, share)} />
              <Box component="circle" cx={c.x} cy={c.y} r={5 + share * 8} sx={s.starCore} />
            </g>
          );
        })}
      </Box>
      {/* Noms des sections sous leurs étoiles — la légende discrète de la promesse. */}
      {sections.map((sec, i) => (
        <Typography
          key={sec.name}
          component="span"
          className="mono"
          sx={s.starLabel(STAR_POSITIONS[i].x, STAR_POSITIONS[i].y)}
        >
          {sec.name}
        </Typography>
      ))}
    </Box>
  );
}
