import { useState } from 'react';
import { Container, Typography, Box } from '@mui/material';
import { ArrowForward } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import GlassCard from '@/components/ui/GlassCard';
import AdSlot from '@/components/ui/AdSlot';
import { SITE_URL } from '@/lib/constants';
import { TOOLS, TOOL_CATEGORIES, type ToolCategory } from './toolsData';
import { FlashcardPreview, QuizPreview } from './ToolPreviews';
import * as s from './ToolsIndex.styles';

type Filter = 'all' | ToolCategory;

export default function ToolsIndex() {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');

  const getArray = <T,>(key: string): T[] => {
    const value = t(key, { returnObjects: true });
    return Array.isArray(value) ? (value as T[]) : [];
  };

  const intro = getArray<string>('tools.indexAbout');
  const canonical = `${SITE_URL}/outils`;

  const visible = filter === 'all' ? TOOLS : TOOLS.filter((tool) => tool.category === filter);
  const filters: Filter[] = ['all', ...TOOL_CATEGORIES];

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
        <title>{`${t('tools.title')} · Freenote`}</title>
        <meta name="description" content={t('tools.metaDescription')} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${t('tools.title')} · Freenote`} />
        <meta property="og:description" content={t('tools.metaDescription')} />
        <meta property="og:url" content={canonical} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Typography variant="h4" component="h1" sx={s.title}>{t('tools.title')}</Typography>
      <Typography component="p" sx={s.subtitle}>{t('tools.subtitle')}</Typography>

      <Box sx={s.filterRow} role="tablist" aria-label={t('tools.filterLabel')}>
        {filters.map((f) => (
          <Box
            key={f}
            component="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            sx={s.filterChip(filter === f)}
          >
            {t(`tools.categories.${f}`)}
          </Box>
        ))}
      </Box>

      <Box sx={s.bento}>
        {visible.map((tool) => {
          const size = tool.size ?? 'sm';
          const preview =
            size !== 'lg' ? null : tool.key === 'flashcards' ? <FlashcardPreview /> : tool.key === 'quiz' ? <QuizPreview /> : null;
          return (
            <GlassCard key={tool.slug} component={Link} to={`/outils/${tool.slug}`} sx={s.tile(size)}>
              <Box sx={s.tileHead}>
                <Box sx={s.tileIcon(size)} aria-hidden="true">{tool.icon}</Box>
                {/* Badge catégorie sur TOUTES les tuiles (cohérence — plus seulement les tuiles hero). */}
                <Box component="span" sx={s.tileBadge}>{t(`tools.categories.${tool.category}`)}</Box>
              </Box>
              <Typography variant="h6" component="h2" sx={s.tileTitle(size)}>
                {t(`tools.${tool.key}.name`)}
              </Typography>
              <Typography variant="body2" sx={s.tileDesc(size)}>
                {t(`tools.${tool.key}.short`)}
              </Typography>
              {preview && <Box sx={s.previewWrap}>{preview}</Box>}
              <Box sx={s.tileCta}>
                {t('tools.openTool')} <ArrowForward fontSize="small" />
              </Box>
            </GlassCard>
          );
        })}
      </Box>

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
