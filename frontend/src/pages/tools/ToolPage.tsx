import { Suspense, useEffect } from 'react';
import {
  Container, Typography, Box, Breadcrumbs, Link as MuiLink,
  Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import { ExpandMore, ArrowBack, NavigateNext } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import OrbitalLoader from '@/components/ui/OrbitalLoader';
import AdSlot from '@/components/ui/AdSlot';
import { SITE_URL } from '@/lib/constants';
import { trackUse } from '@/lib/track';
import type { ToolDef } from './toolsData';
import * as s from './ToolPage.styles';

interface Faq {
  q: string;
  a: string;
}

export default function ToolPage({ tool }: { tool: ToolDef }) {
  const { t, i18n } = useTranslation();
  const base = `tools.${tool.key}`;
  const Component = tool.Component;

  // Statistique d'usage anonyme par outil (analytics admin) — une ouverture = un événement.
  useEffect(() => {
    trackUse('tool', tool.slug);
  }, [tool.slug]);

  const getArray = <T,>(key: string): T[] => {
    const value = t(key, { returnObjects: true });
    return Array.isArray(value) ? (value as T[]) : [];
  };

  const name = t(`${base}.name`);
  const lead = t(`${base}.lead`);
  const seoTitle = t(`${base}.seoTitle`);
  const seoDescription = t(`${base}.seoDescription`);
  const about = getArray<string>(`${base}.about`);
  const examples = getArray<string>(`${base}.examples`);
  const faq = getArray<Faq>(`${base}.faq`);

  const canonical = `${SITE_URL}/outils/${tool.slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name,
        description: seoDescription,
        url: canonical,
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        isAccessibleForFree: true,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: t('tools.title'), item: `${SITE_URL}/outils` },
          { '@type': 'ListItem', position: 3, name, item: canonical },
        ],
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
    <Container maxWidth={tool.wide ? 'xl' : 'md'} sx={s.container}>
      <Helmet>
        <html lang={i18n.language} />
        <title>{`${seoTitle} · Freenote`}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${seoTitle} · Freenote`} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:url" content={canonical} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Breadcrumbs separator={<NavigateNext fontSize="small" />} sx={s.breadcrumbs} aria-label="breadcrumb">
        <MuiLink component={Link} to="/" color="inherit" underline="hover">{t('nav.home')}</MuiLink>
        <MuiLink component={Link} to="/outils" color="inherit" underline="hover">{t('tools.title')}</MuiLink>
        <Typography color="text.primary" sx={{ fontSize: 'inherit' }}>{name}</Typography>
      </Breadcrumbs>

      <Typography variant="h4" component="h1" sx={s.title}>{name}</Typography>
      <Typography component="p" sx={s.lead}>{lead}</Typography>

      <Box sx={s.toolWrap}>
        <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><OrbitalLoader size={48} /></Box>}>
          <Component />
        </Suspense>
      </Box>

      <AdSlot width={728} height={90} sx={{ my: 4 }} />

      {/* SEO / educational content */}
      <Box component="section">
        {about.length > 0 && (
          <>
            <Typography variant="h5" component="h2" sx={s.sectionHeading}>{t('tools.aboutTitle')}</Typography>
            {about.map((para, i) => (
              <Typography key={i} component="p" sx={s.paragraph}>{para}</Typography>
            ))}
          </>
        )}

        {examples.length > 0 && (
          <>
            <Typography variant="h5" component="h2" sx={s.sectionHeading}>{t('tools.examplesTitle')}</Typography>
            <Box component="ul" sx={s.exampleList}>
              {examples.map((ex, i) => (
                <Box component="li" key={i} sx={s.exampleItem}>{ex}</Box>
              ))}
            </Box>
          </>
        )}

        {faq.length > 0 && (
          <>
            <Typography variant="h5" component="h2" sx={s.sectionHeading}>{t('tools.faqTitle')}</Typography>
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
          </>
        )}
      </Box>

      <MuiLink component={Link} to="/outils" underline="hover" sx={s.backLink}>
        <ArrowBack fontSize="small" /> {t('tools.allTools')}
      </MuiLink>
    </Container>
  );
}
