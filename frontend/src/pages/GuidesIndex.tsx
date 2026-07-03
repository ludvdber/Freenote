import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Chip, CircularProgress } from '@mui/material';
import { ArrowForward, MenuBook } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { listGuides } from '@/api/endpoints';
import { STALE_15M, SITE_URL } from '@/lib/constants';
import { useAuthStore } from '@/stores/useAuthStore';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';
import AdSlot from '@/components/ui/AdSlot';

export default function GuidesIndex() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ['guides'],
    queryFn: () => listGuides({ size: 50 }),
    staleTime: STALE_15M,
  });

  const guides = data?.content ?? [];
  const showAd = !user?.supporter;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${t('guides.title')} · Freenote`,
    description: t('guides.metaDescription'),
    url: `${SITE_URL}/guides`,
    hasPart: guides.map((g) => ({
      '@type': 'Article',
      headline: g.title,
      url: `${SITE_URL}/guides/${g.slug}`,
      ...(g.summary ? { description: g.summary } : {}),
    })),
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language === 'fr' ? 'fr-BE' : 'en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

  return (
    <PageWrapper>
      <Helmet>
        <title>{t('guides.title')} · Freenote</title>
        <meta name="description" content={t('guides.metaDescription')} />
        <link rel="canonical" href={`${SITE_URL}/guides`} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${t('guides.title')} · Freenote`} />
        <meta property="og:description" content={t('guides.metaDescription')} />
        <meta property="og:url" content={`${SITE_URL}/guides`} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <MenuBook sx={{ fontSize: 34, color: 'primary.main' }} aria-hidden="true" />
          <Typography variant="h1" sx={{ fontWeight: 800, fontSize: { xs: '1.9rem', md: '2.4rem' }, letterSpacing: '-0.02em' }}>
            {t('guides.title')}
          </Typography>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 680 }}>{t('guides.intro')}</Typography>

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={32} /></Box>
        )}

        {!isLoading && guides.length === 0 && (
          <GlassCard sx={{ p: 5, textAlign: 'center' }}>
            <Typography color="text.secondary">{t('guides.empty')}</Typography>
          </GlassCard>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          {guides.map((g) => (
            <GlassCard
              key={g.id}
              component={RouterLink}
              to={`/guides/${g.slug}`}
              sx={{
                p: 2.5, textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 1,
                color: 'inherit', height: '100%',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                {g.category && <Chip size="small" label={g.category} variant="outlined" color="primary" sx={{ height: 22 }} />}
                <Typography variant="caption" color="text.secondary">{fmtDate(g.createdAt)}</Typography>
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', lineHeight: 1.3 }}>{g.title}</Typography>
              {g.summary && (
                <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>{g.summary}</Typography>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'primary.main', fontWeight: 600, fontSize: '0.85rem', mt: 0.5 }}>
                {t('guides.read')} <ArrowForward sx={{ fontSize: 16 }} />
              </Box>
            </GlassCard>
          ))}
        </Box>

        {showAd && guides.length > 0 && (
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
            <AdSlot width={728} height={90} />
          </Box>
        )}
      </Box>
    </PageWrapper>
  );
}
