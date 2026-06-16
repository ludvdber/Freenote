import { Container, Typography, Box, Grid } from '@mui/material';
import { ArrowForward } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import GlassCard from '@/components/ui/GlassCard';
import AdSlot from '@/components/ui/AdSlot';
import { SITE_URL } from '@/lib/constants';
import { TOOLS } from './toolsData';
import * as s from './ToolsIndex.styles';

export default function ToolsIndex() {
  const { t, i18n } = useTranslation();

  const getArray = <T,>(key: string): T[] => {
    const value = t(key, { returnObjects: true });
    return Array.isArray(value) ? (value as T[]) : [];
  };

  const intro = getArray<string>('tools.indexAbout');
  const canonical = `${SITE_URL}/outils`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t('tools.title'),
    description: t('tools.metaDescription'),
    url: canonical,
    hasPart: TOOLS.map((tool) => ({
      '@type': 'SoftwareApplication',
      name: t(`tools.${tool.key}.name`),
      url: `${SITE_URL}/outils/${tool.slug}`,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    })),
  };

  return (
    <Container maxWidth="lg" sx={s.container}>
      <Helmet>
        <html lang={i18n.language} />
        <title>{`${t('tools.title')} — Freenote`}</title>
        <meta name="description" content={t('tools.metaDescription')} />
        <link rel="canonical" href={canonical} />
        <link rel="alternate" hrefLang="fr" href={canonical} />
        <link rel="alternate" hrefLang="en" href={canonical} />
        <link rel="alternate" hrefLang="x-default" href={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${t('tools.title')} — Freenote`} />
        <meta property="og:description" content={t('tools.metaDescription')} />
        <meta property="og:url" content={canonical} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Typography variant="h4" component="h1" sx={s.title}>{t('tools.title')}</Typography>
      <Typography component="p" sx={s.subtitle}>{t('tools.subtitle')}</Typography>

      <Grid container spacing={2.5}>
        {TOOLS.map((tool) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={tool.slug}>
            <GlassCard component={Link} to={`/outils/${tool.slug}`} sx={s.card}>
              <Box sx={s.cardIcon} aria-hidden="true">{tool.icon}</Box>
              <Typography variant="h6" component="h2" sx={s.cardTitle}>{t(`tools.${tool.key}.name`)}</Typography>
              <Typography variant="body2" sx={s.cardDesc}>{t(`tools.${tool.key}.short`)}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'primary.main', fontWeight: 600, fontSize: '0.85rem' }}>
                {t('tools.openTool')} <ArrowForward fontSize="small" />
              </Box>
            </GlassCard>
          </Grid>
        ))}
      </Grid>

      <AdSlot width={728} height={90} sx={{ my: 5 }} />

      {intro.length > 0 && (
        <Box component="section">
          <Typography variant="h5" component="h2" sx={s.sectionHeading}>{t('tools.indexAboutTitle')}</Typography>
          {intro.map((para, i) => (
            <Typography key={i} component="p" sx={s.paragraph}>{para}</Typography>
          ))}
        </Box>
      )}
    </Container>
  );
}
