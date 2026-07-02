import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Chip, CircularProgress, Button, Alert } from '@mui/material';
import { ArrowForward, Lock, Star } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { listPublicDocuments } from '@/api/endpoints';
import { STALE_15M, SITE_URL, DISCORD_OAUTH_URL } from '@/lib/constants';
import { useAuthStore } from '@/stores/useAuthStore';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';
import AdSlot from '@/components/ui/AdSlot';

export default function ResourcesIndex() {
  const { t, i18n } = useTranslation();
  const { token, user } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ['public-documents'],
    queryFn: () => listPublicDocuments({ size: 36 }),
    staleTime: STALE_15M,
  });

  const docs = data?.content ?? [];
  const showAd = !user?.supporter;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${t('resources.title')} — Freenote`,
    description: t('resources.metaDescription'),
    url: `${SITE_URL}/ressources`,
    hasPart: docs.map((d) => ({
      '@type': 'CreativeWork',
      name: d.title,
      url: `${SITE_URL}/ressources/${d.id}`,
      ...(d.courseName ? { about: d.courseName } : {}),
    })),
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language === 'fr' ? 'fr-BE' : 'en-GB', { month: 'short', year: 'numeric' });

  return (
    <PageWrapper>
      <Helmet>
        <title>{t('resources.title')} — Freenote</title>
        <meta name="description" content={t('resources.metaDescription')} />
        <link rel="canonical" href={`${SITE_URL}/ressources`} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${t('resources.title')} — Freenote`} />
        <meta property="og:description" content={t('resources.metaDescription')} />
        <meta property="og:url" content={`${SITE_URL}/ressources`} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
        <Typography variant="h1" sx={{ fontWeight: 800, fontSize: { xs: '1.9rem', md: '2.4rem' }, letterSpacing: '-0.02em', mb: 1 }}>
          {t('resources.title')}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>{t('resources.intro')}</Typography>

        {/* Public-preview notice + login CTA (only for anonymous visitors) */}
        {!token && (
          <Alert
            severity="info"
            icon={<Lock fontSize="inherit" />}
            sx={{ mb: 3 }}
            action={
              <Button color="inherit" size="small" component="a" href={DISCORD_OAUTH_URL}>
                {t('resources.loginCta')}
              </Button>
            }
          >
            {t('resources.previewNotice')}
          </Alert>
        )}

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={32} /></Box>
        )}
        {!isLoading && docs.length === 0 && (
          <GlassCard sx={{ p: 5, textAlign: 'center' }}>
            <Typography color="text.secondary">{t('resources.empty')}</Typography>
          </GlassCard>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
          {docs.map((d) => (
            <GlassCard
              key={d.id}
              component={RouterLink}
              to={`/ressources/${d.id}`}
              sx={{ p: 2, textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Chip size="small" label={t(`categories.${d.category}`)} variant="outlined" color="primary" sx={{ height: 22 }} />
                {d.year && <Typography variant="caption" color="text.secondary">{d.year}</Typography>}
                {d.ratingCount > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 'auto', color: 'warning.main' }}>
                    <Star sx={{ fontSize: 14 }} />
                    <Typography variant="caption" className="mono">{Number(d.averageRating).toFixed(1)}</Typography>
                  </Box>
                )}
              </Box>
              <Typography sx={{ fontWeight: 700, lineHeight: 1.3 }}>{d.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                {[d.courseName, d.sectionName].filter(Boolean).join(' · ')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">{fmtDate(d.createdAt)}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'primary.main', fontWeight: 600, fontSize: '0.85rem' }}>
                  {t('resources.preview')} <ArrowForward sx={{ fontSize: 16 }} />
                </Box>
              </Box>
            </GlassCard>
          ))}
        </Box>

        {showAd && docs.length > 0 && (
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
            <AdSlot width={728} height={90} />
          </Box>
        )}
      </Box>
    </PageWrapper>
  );
}
