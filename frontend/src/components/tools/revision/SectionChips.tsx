import { Box, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';
import type { SectionCount, SectionScope } from './lib';

/**
 * Rangée de chips « périmètre section » de la bibliothèque de révision : « Tout » TOUT À
 * GAUCHE (position fixe, trouvable sans scroller même avec beaucoup de sections — demande
 * 2026-07-08), puis la section de l'utilisateur (marquée 🎓), les autres par volume,
 * « Sans section » en fin. Compteurs dérivés des données chargées — rien à maintenir.
 */
export default function SectionChips({ counts, total, scope, onScope }: {
  counts: SectionCount[];
  total: number;
  scope: SectionScope;
  onScope: (s: SectionScope) => void;
}) {
  const { t } = useTranslation();
  const mySectionId = useAuthStore((st) => st.user?.sectionId ?? null);

  const mine = counts.find((c) => c.id !== null && c.id === mySectionId);
  const others = counts.filter((c) => c.id !== null && c.id !== mySectionId);
  const none = counts.find((c) => c.id === null);

  const chipSx = (active: boolean) => ({
    fontWeight: 700,
    ...(active
      ? {
          bgcolor: 'rgba(0,210,255,0.12)',
          borderColor: 'rgba(0,210,255,0.5)',
          color: '#00d2ff',
          // MUI Chip clickable : fixer le hover sinon il repasse au gris du thème.
          '&:hover': { bgcolor: 'rgba(0,210,255,0.18)' },
        }
      : {}),
  });

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2.5 }}>
      <Chip
        label={`${t('tools.revision.allSections')} · ${total}`}
        variant="outlined"
        clickable
        onClick={() => onScope('all')}
        sx={chipSx(scope === 'all')}
      />
      {mine && (
        <Chip
          label={`🎓 ${t('tools.revision.mySection')} · ${mine.name} · ${mine.count}`}
          variant="outlined"
          clickable
          onClick={() => onScope(scope === mine.id ? 'all' : mine.id!)}
          sx={{ ...chipSx(scope === mine.id), borderStyle: 'dashed' }}
        />
      )}
      {others.map((c) => (
        <Chip
          key={c.id}
          label={`${c.name ?? '?'} · ${c.count}`}
          variant="outlined"
          clickable
          onClick={() => onScope(scope === c.id ? 'all' : c.id!)}
          sx={chipSx(scope === c.id)}
        />
      ))}
      {none && (
        <Chip
          label={`${t('tools.revision.noSection')} · ${none.count}`}
          variant="outlined"
          clickable
          onClick={() => onScope(scope === 'none' ? 'all' : 'none')}
          sx={chipSx(scope === 'none')}
        />
      )}
    </Box>
  );
}
