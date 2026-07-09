import { Typography, Box, Chip, Button, Alert, CardContent, CircularProgress } from '@mui/material';
import { Lock, ArrowForward, Star } from '@mui/icons-material';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { getPublicCourse, listPublicDocuments } from '@/api/endpoints';
import { STALE_15M, SITE_URL, DISCORD_OAUTH_URL } from '@/lib/constants';
import { categoryColor, categoryEmoji, courseHueShift, formatRelativeDate } from '@/lib/utils';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';
import * as dc from '@/components/common/DocumentCard.styles';
import { TelescopeSky } from '@/components/ui/EmptySky';
import * as cs from './Course.styles';

/**
 * Teaser public de la page cours (/courses/:id pour un anonyme — la version connectée vit dans
 * Course.tsx, App.tsx choisit via CourseRoute). Surface SEO : nom réel + compteurs + les docs des
 * catégories publiques (mêmes couvertures que la vitrine /browse), CTA de connexion pour le reste.
 */
export default function PublicCourse() {
  const { t, i18n } = useTranslation();
  const { courseId } = useParams<{ courseId: string }>();
  const id = Number(courseId);

  const { data: course, isLoading, isError } = useQuery({
    queryKey: ['public-course', id],
    queryFn: () => getPublicCourse(id),
    enabled: !!courseId,
    staleTime: STALE_15M,
    retry: false,
  });

  const { data: docsPage } = useQuery({
    queryKey: ['public-documents', 'course', id],
    queryFn: () => listPublicDocuments({ courseId: id, size: 24 }),
    enabled: !!courseId && (course?.publicDocumentCount ?? 0) > 0,
    staleTime: STALE_15M,
  });
  const docs = docsPage?.content ?? [];

  if (isLoading) {
    return (
      <PageWrapper>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress size={32} /></Box>
      </PageWrapper>
    );
  }

  if (isError || !course) {
    return (
      <PageWrapper maxWidth="sm">
        <Helmet><title>{t('publicCourse.notFound')} · Freenote</title></Helmet>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <TelescopeSky />
          <Typography color="text.secondary" sx={{ mb: 3 }}>{t('publicCourse.notFound')}</Typography>
          <Button variant="outlined" component={RouterLink} to="/browse">{t('nav.browse')}</Button>
        </Box>
      </PageWrapper>
    );
  }

  const description = t('publicCourse.metaDescription', {
    name: course.name,
    section: course.sectionName,
    count: course.documentCount,
  });

  return (
    <PageWrapper>
      <Helmet>
        <title>{`${course.name} · Freenote`}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`${SITE_URL}/courses/${course.id}`} />
      </Helmet>

      <GlassCard sx={cs.hero}>
        <Box sx={cs.heroGlow} aria-hidden="true" />
        <Box sx={cs.heroContent}>
          <Typography sx={cs.kicker}>{course.sectionName}</Typography>
          <Typography variant="h4" component="h1" sx={cs.title}>{course.name}</Typography>
          <Typography sx={cs.subline}>
            {t('publicCourse.sharedCount', { count: course.documentCount })}
          </Typography>
          <Box sx={cs.ctaRow}>
            <Button variant="contained" startIcon={<Lock />} component="a" href={DISCORD_OAUTH_URL}>
              {t('publicCourse.loginCta')}
            </Button>
          </Box>
        </Box>
      </GlassCard>

      <Alert severity="info" icon={<Lock fontSize="small" />} sx={{ mb: 3 }}>
        {t('resources.previewNotice')}
      </Alert>

      {docs.length > 0 ? (
        <>
          <Typography component="h2" sx={cs.docsHeading}>
            {t('publicCourse.publicDocs', { count: course.publicDocumentCount })}
          </Typography>
          {/* Mêmes couvertures v4 que la vitrine /browse (styles partagés DocumentCard.styles). */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
            {docs.map((d) => (
              <GlassCard key={d.id} component={RouterLink} to={`/documents/${d.id}`} sx={dc.card(0)}>
                <Box sx={dc.cover}>
                  <Box className="doc-cover-bg" sx={dc.coverBg(d.category, courseHueShift(d.courseName))} />
                  <Typography component="span" aria-hidden="true" sx={dc.coverEmoji}>
                    {categoryEmoji(d.category)}
                  </Typography>
                  <Chip
                    label={t(`categories.${d.category}`)}
                    size="small"
                    sx={dc.coverCatChip(categoryColor(d.category, 'dark'))}
                  />
                </Box>
                <CardContent sx={dc.content}>
                  <Typography variant="subtitle2" className="doc-title" sx={dc.titleClamp}>
                    {d.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={dc.courseLine}>
                    {[d.courseName, d.sectionName, d.year].filter(Boolean).join(' · ')}
                  </Typography>
                  <Box sx={dc.footerRow}>
                    <Box sx={dc.metaRow}>
                      <Typography variant="caption" color="text.secondary" sx={dc.relativeDate}>
                        {formatRelativeDate(d.createdAt, i18n.language)}
                      </Typography>
                      {d.ratingCount > 0 && (
                        <Box sx={dc.ratingBox}>
                          <Star sx={dc.ratingIcon} />
                          <Typography variant="caption" className="mono" sx={{ fontWeight: 700 }}>
                            {Number(d.averageRating).toFixed(1)}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'primary.main', fontWeight: 600, fontSize: '0.8rem', flexShrink: 0 }}>
                      {t('resources.preview')} <ArrowForward sx={{ fontSize: 15 }} />
                    </Box>
                  </Box>
                </CardContent>
              </GlassCard>
            ))}
          </Box>
        </>
      ) : (
        <GlassCard sx={{ p: 5, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 32, mb: 1 }} aria-hidden="true">🔒</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>{t('publicCourse.reserved')}</Typography>
          <Button variant="contained" component="a" href={DISCORD_OAUTH_URL}>
            {t('resources.loginCta')}
          </Button>
        </GlassCard>
      )}
    </PageWrapper>
  );
}
