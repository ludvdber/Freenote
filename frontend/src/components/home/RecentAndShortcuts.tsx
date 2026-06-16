import { Box, Typography, Chip } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { getRecentDocs } from '@/api/endpoints';
import { useAuthStore } from '@/stores/useAuthStore';
import GlassCard from '@/components/ui/GlassCard';
import { SHORTCUTS } from './RecentAndShortcuts.data';
import * as s from './RecentAndShortcuts.styles';

export default function RecentAndShortcuts() {
  const { t } = useTranslation();
  const { token, user } = useAuthStore();

  const { data: recent } = useQuery({
    queryKey: ['recent-docs'],
    queryFn: () => getRecentDocs(6),
    enabled: Boolean(token),
    staleTime: 60_000,
  });

  const hasRecent = (recent?.length ?? 0) > 0;

  return (
    <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      <Box sx={s.section}>
        <Box sx={s.row}>
          <Box sx={s.col}>
            <Typography variant="h5" component="h2" sx={s.colTitle}>
              <span aria-hidden="true">📖</span> {t('home.recent.title')}
            </Typography>
            <GlassCard sx={s.card}>
              {!hasRecent && (
                <Box sx={s.empty}>
                  <Typography sx={{ fontSize: 28, mb: 1 }} aria-hidden="true">👋</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('home.recent.empty')}
                  </Typography>
                </Box>
              )}
              {hasRecent && (
                <Box sx={s.recentList}>
                  {recent!.map((doc) => (
                    <Box
                      key={doc.id}
                      component={Link}
                      to={`/documents/${doc.id}`}
                      sx={s.recentItem}
                    >
                      <Box sx={s.recentIcon} aria-hidden="true">📄</Box>
                      <Box sx={s.recentMeta}>
                        <Typography sx={s.recentTitle}>{doc.title}</Typography>
                        <Typography sx={s.recentSubtitle}>
                          {doc.courseName} · {t(`categories.${doc.category}`)}
                        </Typography>
                      </Box>
                      {doc.averageRating > 0 && (
                        <Chip size="small" label={`★ ${doc.averageRating.toFixed(1)}`} variant="outlined" />
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </GlassCard>
          </Box>

          <Box sx={s.col}>
            <Typography variant="h5" component="h2" sx={s.colTitle}>
              <span aria-hidden="true">⚡</span> {t('home.shortcuts.title')}
            </Typography>
            <GlassCard sx={s.card}>
              <Box sx={s.shortcutsGrid}>
                {SHORTCUTS.map((sc) => {
                  const disabled = Boolean(sc.requireVerified && !user?.verified);
                  const inlineStyle = disabled ? { opacity: 0.5, pointerEvents: 'none' as const } : undefined;
                  const label = t(`home.shortcuts.items.${sc.key}`);
                  const body = (
                    <>
                      <Box sx={s.shortcutIcon} aria-hidden="true">{sc.icon}</Box>
                      <Typography sx={s.shortcutLabel}>{label}</Typography>
                    </>
                  );
                  if (sc.to) {
                    return (
                      <Box key={sc.key} component={Link} to={sc.to} sx={s.shortcutTile} style={inlineStyle} aria-disabled={disabled || undefined}>
                        {body}
                      </Box>
                    );
                  }
                  return (
                    <Box
                      key={sc.key}
                      component="a"
                      href={sc.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={s.shortcutTile}
                      style={inlineStyle}
                      aria-disabled={disabled || undefined}
                    >
                      {body}
                    </Box>
                  );
                })}
              </Box>
            </GlassCard>
          </Box>
        </Box>
      </Box>
    </motion.section>
  );
}
