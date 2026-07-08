import { Box, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { guideCover } from '@/lib/guideCover';
import GlassCard from '@/components/ui/GlassCard';
import type { GuideSummary } from '@/types';

/**
 * Carte compacte d'un guide (pastille émoji teintée + titre + catégorie · temps de lecture) —
 * utilisée par la section « Ses guides » du profil public et le « À lire ensuite » de GuideDetail.
 */
export default function GuideMiniCard({ guide }: { guide: GuideSummary }) {
  const { t } = useTranslation();
  const cover = guideCover(guide.category);

  return (
    <GlassCard
      component={RouterLink}
      to={`/guides/${guide.slug}`}
      sx={{
        p: 2, display: 'flex', alignItems: 'center', gap: 1.5, height: '100%',
        textDecoration: 'none', color: 'inherit',
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      <Box aria-hidden="true" sx={{
        width: 44, height: 44, borderRadius: 2, flexShrink: 0, fontSize: 22,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: cover.gradient,
      }}>
        {cover.emoji}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap>{guide.title}</Typography>
        <Typography variant="caption" color="text.secondary">
          {guide.category ? `${guide.category} · ` : ''}{t('guides.readTime', { count: guide.readMinutes })}
        </Typography>
      </Box>
    </GlassCard>
  );
}
