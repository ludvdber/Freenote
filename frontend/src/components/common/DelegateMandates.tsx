import { Box, Typography, Chip } from '@mui/material';
import { HowToVote } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import GlassCard from '@/components/ui/GlassCard';
import type { DelegateHistoryResponse } from '@/types';

const yearOf = (iso: string) => new Date(iso).getFullYear();

/**
 * Elegant delegate-mandate list for a profile: one accented row per mandate showing the section and
 * the year range (e.g. "2023 – 2024", or "2024 – en cours" for an active one), with a status pill
 * (Délégué / Ancien délégué). Active mandates float to the top, then most-recently ended. Renders
 * nothing when there is no history, so callers can drop it in unconditionally.
 */
export default function DelegateMandates({
  history,
  title,
}: {
  history: DelegateHistoryResponse[] | undefined;
  title: string;
}) {
  const { t } = useTranslation();
  if (!history || history.length === 0) return null;

  const sorted = [...history].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return yearOf(b.endDate ?? b.startDate) - yearOf(a.endDate ?? a.startDate);
  });

  return (
    <GlassCard sx={{ p: 2.5, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <HowToVote fontSize="small" color="primary" />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {sorted.map((dh) => {
          const start = yearOf(dh.startDate);
          const end = dh.endDate ? yearOf(dh.endDate) : null;
          const range = end ? `${start} – ${end}` : `${start} – ${t('delegates.ongoing')}`;
          return (
            <Box
              key={dh.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.5,
                py: 1,
                borderRadius: 2,
                borderLeft: '3px solid',
                borderColor: dh.active ? 'success.main' : 'divider',
                bgcolor: (th) =>
                  th.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                  {dh.sectionName}
                </Typography>
                <Typography variant="caption" color="text.secondary" className="mono">
                  {range}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={dh.active ? t('badges.delegate') : t('badges.formerDelegate')}
                color={dh.active ? 'success' : 'default'}
                variant={dh.active ? 'filled' : 'outlined'}
                sx={{ fontSize: 11, fontWeight: 600, opacity: dh.active ? 1 : 0.85 }}
              />
            </Box>
          );
        })}
      </Box>
    </GlassCard>
  );
}
