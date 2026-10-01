import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Chip, CircularProgress, Grid, Button, LinearProgress } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { getCatalogueGaps } from '@/api/endpoints';
import { STALE_15M, SITE_URL } from '@/lib/constants';
import { useAuthStore } from '@/stores/useAuthStore';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';

/**
 * « Ce qui manque » — page PUBLIQUE listant les cours sans aucun document.
 *
 * Deux raisons d'exister. Pour l'étudiant : la réponse honnête à « pourquoi je ne trouve rien pour
 * ce cours », et un appel au dépôt là où le besoin est réel plutôt qu'un « sois le premier » lancé
 * dans le vide. Pour les moteurs : une page qui nomme des cours de l'ISFCE que personne d'autre ne
 * liste, sans exposer aucun contenu protégé — rien que des noms du référentiel de l'école.
 */
export default function CatalogueGaps() {
  const { t } = useTranslation();
  const { token } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['catalogue-gaps'],
    queryFn: getCatalogueGaps,
    staleTime: STALE_15M,
  });

  const filled = data && data.totalCourses > 0
    ? Math.round(((data.totalCourses - data.emptyCourses) / data.totalCourses) * 100)
    : 0;

  return (
    <PageWrapper>
      <Helmet>
        <title>{t('gaps.metaTitle')}</title>
        <meta name="description" content={t('gaps.metaDescription')} />
        <link rel="canonical" href={`${SITE_URL}/manques`} />
      </Helmet>

      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>{t('gaps.title')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 680 }}>{t('gaps.intro')}</Typography>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : !data ? null : (
        <>
          {/* Couverture du catalogue : le manque n'a de sens que rapporté à l'ensemble. */}
          <GlassCard sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
              {t('gaps.coverage', { filled, total: data.totalCourses })}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={filled}
              aria-label={t('gaps.coverage', { filled, total: data.totalCourses })}
              sx={{ height: 8, borderRadius: 99, my: 1.5 }}
            />
            <Typography variant="body2" color="text.secondary">
              {t('gaps.remaining', { count: data.emptyCourses })}
            </Typography>
            {token && (
              <Button
                component={RouterLink}
                to="/upload"
                variant="contained"
                startIcon={<CloudUpload />}
                sx={{ mt: 2 }}
              >
                {t('gaps.cta')}
              </Button>
            )}
          </GlassCard>

          {data.sections.length === 0 ? (
            <GlassCard sx={{ p: 4, textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 700 }}>{t('gaps.empty')}</Typography>
            </GlassCard>
          ) : (
            <Grid container spacing={2.5}>
              {data.sections.map((section) => (
                <Grid key={section.sectionId} size={{ xs: 12, md: 6 }}>
                  <GlassCard sx={{ p: 2.5, height: '100%' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                      <Box component="span" aria-hidden="true" sx={{ mr: 0.75 }}>{section.icon}</Box>
                      {section.sectionName}
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {t('gaps.sectionCount', { count: section.courses.length })}
                      </Typography>
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {/* Chaque chip mène à la page du cours : c'est là qu'on dépose, et la page
                          existe même vide (elle a son propre état « aucun document »). */}
                      {section.courses.map((course) => (
                        <Chip
                          key={course.id}
                          component={RouterLink}
                          to={`/courses/${course.id}`}
                          clickable
                          size="small"
                          variant="outlined"
                          label={course.name}
                        />
                      ))}
                    </Box>
                  </GlassCard>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}
    </PageWrapper>
  );
}
