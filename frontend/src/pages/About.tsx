import {
  Container, Typography, Box, Grid, Button, Link as MuiLink,
  Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import GlassCard from '@/components/ui/GlassCard';
import { SITE_URL, DISCORD_INVITE_URL } from '@/lib/constants';
import * as s from './About.styles';

interface TitleDesc { title: string; desc: string }
interface Faq { q: string; a: string }

export default function About() {
  const { t, i18n } = useTranslation();

  const getArray = <T,>(key: string): T[] => {
    const value = t(key, { returnObjects: true });
    return Array.isArray(value) ? (value as T[]) : [];
  };

  const mission = getArray<string>('about.mission');
  const problems = getArray<TitleDesc>('about.problems');
  const how = getArray<TitleDesc>('about.how');
  const features = getArray<TitleDesc>('about.features');
  const privacy = getArray<string>('about.privacy');
  const faq = getArray<Faq>('about.faq');

  const canonical = `${SITE_URL}/a-propos`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'AboutPage',
        name: t('about.title'),
        description: t('about.metaDescription'),
        url: canonical,
      },
      {
        '@type': 'Organization',
        name: 'Freenote',
        url: SITE_URL,
        description: t('about.orgDescription'),
      },
      ...(faq.length
        ? [{
            '@type': 'FAQPage',
            mainEntity: faq.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }]
        : []),
    ],
  };

  return (
    <Container maxWidth="md" sx={s.container}>
      <Helmet>
        <html lang={i18n.language} />
        <title>{`${t('about.metaTitle')} · Freenote`}</title>
        <meta name="description" content={t('about.metaDescription')} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${t('about.metaTitle')} · Freenote`} />
        <meta property="og:description" content={t('about.metaDescription')} />
        <meta property="og:url" content={canonical} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Typography variant="h3" component="h1" sx={s.title}>{t('about.title')}</Typography>
      <Typography component="p" sx={s.lead}>{t('about.lead')}</Typography>

      {/* Mission */}
      <Box component="section">
        <Typography variant="h5" component="h2" sx={s.sectionHeading}>{t('about.missionTitle')}</Typography>
        {mission.map((p, i) => (
          <Typography key={i} component="p" sx={s.paragraph}>{p}</Typography>
        ))}
      </Box>

      {/* Problems solved */}
      <Box component="section">
        <Typography variant="h5" component="h2" sx={s.sectionHeading}>{t('about.problemsTitle')}</Typography>
        <Grid container spacing={2.5}>
          {problems.map((p, i) => (
            <Grid size={{ xs: 12, sm: 6 }} key={i}>
              <GlassCard sx={s.card}>
                <Typography variant="h6" component="h3" sx={s.cardTitle}>{p.title}</Typography>
                <Typography variant="body2" sx={s.cardDesc}>{p.desc}</Typography>
              </GlassCard>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* How it works */}
      <Box component="section">
        <Typography variant="h5" component="h2" sx={s.sectionHeading}>{t('about.howTitle')}</Typography>
        {how.map((stepItem, i) => (
          <Box sx={s.step} key={i}>
            <Box sx={s.stepNumber} aria-hidden="true">{i + 1}</Box>
            <Box>
              <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700 }}>{stepItem.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>{stepItem.desc}</Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Features */}
      <Box component="section">
        <Typography variant="h5" component="h2" sx={s.sectionHeading}>{t('about.featuresTitle')}</Typography>
        <Grid container spacing={2.5}>
          {features.map((f, i) => (
            <Grid size={{ xs: 12, sm: 6 }} key={i}>
              <GlassCard sx={s.card}>
                <Typography variant="subtitle1" component="h3" sx={s.cardTitle}>{f.title}</Typography>
                <Typography variant="body2" sx={s.cardDesc}>{f.desc}</Typography>
              </GlassCard>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Privacy */}
      <Box component="section">
        <Typography variant="h5" component="h2" sx={s.sectionHeading}>{t('about.privacyTitle')}</Typography>
        {privacy.map((p, i) => (
          <Typography key={i} component="p" sx={s.paragraph}>{p}</Typography>
        ))}
        <MuiLink component={Link} to="/privacy" underline="hover" sx={{ fontWeight: 600 }}>
          {t('about.privacyLink')}
        </MuiLink>
      </Box>

      {/* FAQ */}
      {faq.length > 0 && (
        <Box component="section">
          <Typography variant="h5" component="h2" sx={s.sectionHeading}>{t('about.faqTitle')}</Typography>
          {faq.map((f, i) => (
            <Accordion key={i} disableGutters elevation={0} sx={{ bgcolor: 'transparent' }}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography component="h3" sx={{ fontWeight: 600, fontSize: '1rem' }}>{f.q}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography component="p" color="text.secondary" sx={{ lineHeight: 1.7 }}>{f.a}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* CTA */}
      <GlassCard sx={s.ctaCard}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1 }}>{t('about.ctaTitle')}</Typography>
        <Typography component="p" color="text.secondary" sx={{ maxWidth: 560, mx: 'auto' }}>{t('about.ctaText')}</Typography>
        <Box sx={s.ctaRow}>
          <Button variant="contained" component={Link} to="/browse">{t('about.ctaBrowse')}</Button>
          <Button variant="outlined" component={Link} to="/outils">{t('about.ctaTools')}</Button>
          <Button variant="text" href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">
            {t('about.ctaDiscord')}
          </Button>
        </Box>
      </GlassCard>
    </Container>
  );
}
