import { Box, Typography, Chip, Skeleton } from '@mui/material';
import { Visibility, Verified, EmojiEvents, FavoriteBorder } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { getPopularDocuments, getLeaderboard } from '@/api/endpoints';
import { useAuthStore } from '@/stores/useAuthStore';
import { categoryColor, formatNumber } from '@/lib/utils';
import GlassCard from '@/components/ui/GlassCard';
import { RANK_COLORS } from './PopularDocs.data';
import * as s from './PopularDocs.styles';

export default function PopularDocs() {
  const { t } = useTranslation();
  const { token, user } = useAuthStore();
  const { data: docs, isLoading } = useQuery({
    queryKey: ['popular-docs', user?.sectionId ?? null],
    queryFn: () => getPopularDocuments(user?.sectionId ?? undefined),
  });
  const { data: leaderboard } = useQuery({ queryKey: ['leaderboard', 5], queryFn: () => getLeaderboard(5) });

  const hasDocs = !isLoading && (docs?.length ?? 0) > 0;
  const topDocs = hasDocs ? docs!.slice(0, 6) : [];
  const hasLeaderboard = (leaderboard?.length ?? 0) > 0;

  return (
    <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      <Box sx={s.section}>
        <Box sx={s.row}>
          {/* Popular docs */}
          <Box sx={s.docsCol}>
            <Box sx={s.colHeader}>
              <Typography variant="h5" sx={s.colTitle}>
                <span aria-hidden="true">📚</span> {t('popular.title')}
              </Typography>
              <Box component={Link} to="/browse" sx={s.viewAllLink}>
                {t('popular.viewAll')} →
              </Box>
            </Box>
            <GlassCard sx={s.listCard}>
              {isLoading && Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={48} sx={{ borderRadius: 1, mb: i < 3 ? 1 : 0 }} />
              ))}

              {!isLoading && !hasDocs && (
                <Box sx={s.emptyState}>
                  <Typography sx={{ fontSize: 32, mb: 1 }} aria-hidden="true">✨</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('popular.empty')}
                  </Typography>
                </Box>
              )}

              {topDocs.map((doc, idx) => (
                <Box
                  key={doc.id}
                  component={Link}
                  to={`/documents/${doc.id}`}
                  sx={s.docRow(idx === 0)}
                >
                  <Typography className="mono" sx={s.rank}>
                    {idx + 1}
                  </Typography>
                  <Box sx={s.docInfo}>
                    <Typography variant="body2" sx={s.docTitle} noWrap>
                      {doc.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {doc.courseName} — {doc.authorName}
                    </Typography>
                  </Box>
                  <Chip
                    label={t(`categories.${doc.category}`)}
                    size="small"
                    sx={s.categoryChip(categoryColor(doc.category))}
                  />
                  {doc.verified && <Verified sx={s.verifiedIcon} />}
                  <Box sx={s.dlCol}>
                    <Visibility sx={s.dlIcon} />
                    <Typography variant="caption" className="mono" color="text.secondary">
                      {formatNumber(doc.downloadCount)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </GlassCard>
          </Box>

          {/* Leaderboard */}
          <Box sx={s.leaderboardCol}>
            <Box sx={s.colHeader}>
              <Typography variant="h5" sx={s.colTitle}>
                <span aria-hidden="true">🏆</span> {t('leaderboard.title')}
              </Typography>
              {hasLeaderboard && (
                <Box component={Link} to="/leaderboard" sx={s.viewAllLink}>
                  {t('leaderboard.viewAll')} →
                </Box>
              )}
            </Box>
            <GlassCard sx={s.listCard}>
              {!hasLeaderboard && (
                <Box sx={s.emptyState}>
                  <Typography sx={{ fontSize: 32, mb: 1 }} aria-hidden="true">🏅</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('leaderboard.empty')}
                  </Typography>
                </Box>
              )}
              {leaderboard?.slice(0, 5).map((entry) => {
                const rankColor = RANK_COLORS[entry.rank - 1] ?? '#888';
                return (
                  <Box
                    key={entry.rank}
                    component={token ? Link : 'div'}
                    {...(token ? { to: `/users/${entry.userId}` } : {})}
                    sx={s.docRow(false)}
                  >
                    <Box sx={s.medalCircle(entry.rank, rankColor)}>
                      {entry.rank <= 3 ? (
                        <EmojiEvents sx={{ fontSize: 20, color: rankColor }} />
                      ) : (
                        <Typography className="mono" sx={s.rank}>
                          #{entry.rank}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={s.docInfo}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={s.docTitle}>
                          {entry.displayName}
                        </Typography>
                        {entry.supporter && (
                          <Chip
                            icon={<FavoriteBorder sx={{ fontSize: '12px !important' }} />}
                            label={t('document.supporter')}
                            size="small"
                            color="secondary"
                            variant="outlined"
                            sx={{ fontSize: 10, height: 20 }}
                          />
                        )}
                      </Box>
                    </Box>
                    <Box sx={s.xpCol}>
                      <Typography className="mono" sx={s.xpValue}>
                        {formatNumber(entry.xp)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        XP
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </GlassCard>
          </Box>
        </Box>

      </Box>
    </motion.section>
  );
}
