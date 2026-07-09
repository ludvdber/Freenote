import { Box, Typography, Chip, Skeleton, Button, useTheme } from '@mui/material';
import { Star, ArrowForward, Lock } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { listPublicDocuments } from '@/api/endpoints';
import { categoryColor } from '@/lib/utils';
import { STALE_15M, DISCORD_OAUTH_URL } from '@/lib/constants';
import { TOOLS, type ToolDef } from '@/pages/tools/toolsData';
import GlassCard from '@/components/ui/GlassCard';
import * as ps from './PopularDocs.styles';

// 3 outils vedettes en tuiles riches (nom + accroche) : les 8 lignes uniformes d'avant ne
// donnaient envie de rien — « tous les outils » reprend le reste.
const FEATURED = ['flashcards', 'quiz', 'calculateur-moyenne'];

/**
 * Anonymous "product proof": same two-column layout as the connected <PopularDocs>, but the docs are
 * the copyright-safe anonymised catalogue slice, and the right column (where logged-in users see the
 * leaderboard) shows the free tools as clickable cards — the SEO magnet, surfaced to every visitor.
 */
export default function PublicDocsPreview() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { data, isLoading } = useQuery({
    queryKey: ['public-documents', 'home'],
    queryFn: () => listPublicDocuments({ size: 6 }),
    staleTime: STALE_15M,
  });
  const docs = data?.content ?? [];
  const hasDocs = !isLoading && docs.length > 0;

  const tools = FEATURED
    .map((slug) => TOOLS.find((x) => x.slug === slug))
    .filter((x): x is ToolDef => Boolean(x));

  return (
    <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      <Box sx={ps.section}>
        <Box sx={ps.row}>
          {/* Aperçu du catalogue — même format que la vue connectée, mais anonymisé (pas d'auteur). */}
          <Box sx={ps.docsCol}>
            <Box sx={ps.colHeader}>
              <Typography variant="h5" component="h2" sx={ps.colTitle}>
                <span aria-hidden="true">📚</span> {t('home.publicDocs.title')}
              </Typography>
              <Box component={Link} to="/browse" sx={ps.viewAllLink}>
                {t('home.publicDocs.viewAll')} →
              </Box>
            </Box>
            <GlassCard sx={ps.listCard}>
              {isLoading && Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={44} sx={{ borderRadius: 1, m: 1 }} />
              ))}

              {!isLoading && !hasDocs && (
                <Box sx={ps.emptyState}>
                  <Typography sx={{ fontSize: 32, mb: 1 }} aria-hidden="true">✨</Typography>
                  <Typography variant="body2" color="text.secondary">{t('popular.empty')}</Typography>
                </Box>
              )}

              {docs.map((d, idx) => (
                <Box key={d.id} component={Link} to={`/documents/${d.id}`} sx={ps.docRow(idx === 0)}>
                  <Typography className="mono" sx={ps.rank}>{idx + 1}</Typography>
                  <Box sx={ps.docInfo}>
                    <Typography variant="body2" sx={ps.docTitle} noWrap>{d.title}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {[d.courseName, d.sectionName].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                  <Chip label={t(`categories.${d.category}`)} size="small" sx={ps.categoryChip(categoryColor(d.category, theme.palette.mode))} />
                  {d.ratingCount > 0 && (
                    <Box sx={ps.dlCol}>
                      <Star sx={{ fontSize: 14, color: 'warning.main' }} />
                      <Typography variant="caption" className="mono" color="text.secondary">
                        {Number(d.averageRating).toFixed(1)}
                      </Typography>
                    </Box>
                  )}
                </Box>
              ))}
            </GlassCard>

            {!isLoading && (
              <Box sx={{ mt: 2 }}>
                <Button variant="contained" startIcon={<Lock />} component="a" href={DISCORD_OAUTH_URL} fullWidth>
                  {t('home.publicDocs.loginCta')}
                </Button>
              </Box>
            )}
          </Box>

          {/* Outils — à la place du classement pour l'anonyme : cartes cliquables (comme les liens utiles). */}
          <Box sx={ps.leaderboardCol}>
            <Box sx={ps.colHeader}>
              <Typography variant="h5" component="h2" sx={ps.colTitle}>
                <span aria-hidden="true">🧰</span> {t('home.tools.title')}
              </Typography>
              <Box component={Link} to="/outils" sx={ps.viewAllLink}>
                {t('home.tools.viewAll')} →
              </Box>
            </Box>
            <GlassCard sx={ps.toolsCard}>
              {tools.map((tool) => (
                <Box key={tool.slug} component={Link} to={`/outils/${tool.slug}`} sx={ps.toolRow}>
                  <Box aria-hidden="true" sx={ps.toolIcon}>
                    {tool.icon}
                  </Box>
                  <Box sx={ps.docInfo}>
                    <Typography variant="body2" sx={ps.docTitle}>{t(`tools.${tool.key}.name`)}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={ps.toolShort}>
                      {t(`tools.${tool.key}.short`)}
                    </Typography>
                  </Box>
                  <ArrowForward sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                </Box>
              ))}
              <Box sx={ps.toolsCta}>
                <Button component={Link} to="/outils" variant="outlined" size="small" fullWidth>
                  {t('tools.allTools')}
                </Button>
              </Box>
            </GlassCard>
          </Box>
        </Box>
      </Box>
    </motion.section>
  );
}
