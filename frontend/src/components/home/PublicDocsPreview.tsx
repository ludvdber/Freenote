import { Box, Typography, Chip, Skeleton, Button } from '@mui/material';
import { ArrowForward, Star, Lock } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listPublicDocuments } from '@/api/endpoints';
import { categoryColor } from '@/lib/utils';
import { STALE_15M, DISCORD_OAUTH_URL } from '@/lib/constants';
import GlassCard from '@/components/ui/GlassCard';

/**
 * Product-proof for anonymous visitors: a small, copyright-safe, anonymised slice of the catalogue
 * (metadata only — no author, no PDF, only the categories the backend deems public). Each card links
 * to the /documents/:id teaser which shows the login gate. This gives the public home real content
 * instead of asking visitors to take the value on faith.
 */
export default function PublicDocsPreview() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['public-documents', 'home'],
    queryFn: () => listPublicDocuments({ size: 6 }),
    staleTime: STALE_15M,
  });
  const docs = data?.content ?? [];

  return (
    <Box component="section" sx={{ py: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 800 }}>
            <span aria-hidden="true">📚</span> {t('home.publicDocs.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">{t('home.publicDocs.subtitle')}</Typography>
        </Box>
        <Box
          component={Link}
          to="/browse"
          sx={{ color: 'primary.main', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          {t('home.publicDocs.viewAll')} <ArrowForward sx={{ fontSize: 16 }} />
        </Box>
      </Box>

      {/* Liste compacte de lignes (accent couleur-catégorie à gauche) — volontairement DIFFÉRENTE des
          tuiles d'outils, pour que l'œil distingue « documents » et « apps ». */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={68} sx={{ borderRadius: 2 }} />
          ))}

        {!isLoading &&
          docs.map((d) => (
            <GlassCard
              key={d.id}
              component={Link}
              to={`/documents/${d.id}`}
              sx={{
                p: 1.5, textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 1.5,
                borderLeft: '3px solid', borderLeftColor: categoryColor(d.category),
                transition: 'transform .15s ease, border-color .15s ease',
                '&:hover': { transform: 'translateX(3px)', borderColor: 'primary.main', borderLeftColor: categoryColor(d.category) },
              }}
            >
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                  <Chip size="small" label={t(`categories.${d.category}`)} sx={{ height: 19, fontSize: 11, bgcolor: `${categoryColor(d.category)}22`, color: categoryColor(d.category), fontWeight: 700 }} />
                  {d.year && <Typography variant="caption" color="text.secondary">{d.year}</Typography>}
                </Box>
                <Typography sx={{ fontWeight: 700, lineHeight: 1.25 }} noWrap>{d.title}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                  {[d.courseName, d.sectionName].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
              {d.ratingCount > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: 'warning.main', flexShrink: 0 }}>
                  <Star sx={{ fontSize: 14 }} />
                  <Typography variant="caption" className="mono">{Number(d.averageRating).toFixed(1)}</Typography>
                </Box>
              )}
            </GlassCard>
          ))}
      </Box>

      {!isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2.5 }}>
          <Button variant="contained" startIcon={<Lock />} component="a" href={DISCORD_OAUTH_URL}>
            {t('home.publicDocs.loginCta')}
          </Button>
        </Box>
      )}
    </Box>
  );
}
