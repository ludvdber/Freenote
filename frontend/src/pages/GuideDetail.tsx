import { useParams, Link as RouterLink } from 'react-router-dom';
import { Typography, Box, Chip, Button } from '@mui/material';
import { ArrowBack, ArrowForward } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { getGuide } from '@/api/endpoints';
import { STALE_15M, SITE_URL } from '@/lib/constants';
import { guideCover } from '@/lib/guideCover';
import { toolBySlug } from '@/pages/tools/toolsData';
import { useAuthStore } from '@/stores/useAuthStore';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';
import AdSlot from '@/components/ui/AdSlot';
import Markdown from '@/components/common/Markdown';
import * as s from './GuideDetail.styles';

export default function GuideDetail() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();

  const { data: guide, isLoading, isError } = useQuery({
    queryKey: ['guide', slug],
    queryFn: () => getGuide(slug as string),
    enabled: Boolean(slug),
    staleTime: STALE_15M,
    retry: false,
  });

  const showAd = !user?.supporter;
  const words = guide?.content ? guide.content.replace(/[#>*`_\-[\]()]/g, ' ').split(/\s+/).filter(Boolean).length : 0;
  const readMinutes = words ? Math.max(1, Math.round(words / 200)) : 0;

  const cover = guideCover(guide?.category);
  const tool = toolBySlug(guide?.relatedTool ?? undefined);
  // Le rail existe s'il a quelque chose à montrer : encart outil et/ou pub.
  const showRail = showAd || Boolean(tool);

  const fullDate = guide?.createdAt
    ? new Date(guide.createdAt).toLocaleDateString(i18n.language.startsWith('fr') ? 'fr-BE' : 'en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';

  const jsonLd = guide
    ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: guide.title,
        ...(guide.summary ? { description: guide.summary } : {}),
        datePublished: guide.createdAt,
        dateModified: guide.updatedAt,
        author: { '@type': 'Person', name: guide.authorName },
        publisher: { '@type': 'Organization', name: 'Freenote' },
        mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
      }
    : null;

  return (
    <PageWrapper>
      <Helmet>
        <title>{guide ? `${guide.title} · Freenote` : `${t('guides.title')} · Freenote`}</title>
        {guide?.summary && <meta name="description" content={guide.summary} />}
        {guide && <link rel="canonical" href={`${SITE_URL}/guides/${guide.slug}`} />}
        {guide && <meta property="og:type" content="article" />}
        {guide && <meta property="og:title" content={`${guide.title} · Freenote`} />}
        {guide?.summary && <meta property="og:description" content={guide.summary} />}
        {guide && <meta property="og:url" content={`${SITE_URL}/guides/${guide.slug}`} />}
        {guide && <meta property="og:image" content={`${SITE_URL}/og-image.png`} />}
        {guide && <meta name="twitter:card" content="summary_large_image" />}
        {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
      </Helmet>

      <Box sx={s.article}>
        <Button component={RouterLink} to="/guides" startIcon={<ArrowBack />} sx={s.backBtn}>
          {t('guides.backToList')}
        </Button>

        {isError ? (
          <GlassCard sx={s.articleCard}><Typography color="text.secondary">{t('guides.notFound')}</Typography></GlassCard>
        ) : isLoading || !guide ? (
          <GlassCard sx={s.articleCard}><Typography color="text.secondary">{t('common.loading')}</Typography></GlassCard>
        ) : (
          <>
            <Box component="header" sx={s.header}>
              <Box sx={s.eyebrow}>
                {guide.category && (
                  <Chip label={`${cover.emoji} ${guide.category}`} size="small" variant="outlined" sx={s.chip(cover.color)} />
                )}
                {fullDate && (
                  <>
                    {guide.category && <Box sx={s.dot} />}
                    <Typography component="span" sx={s.meta}>{fullDate}</Typography>
                  </>
                )}
                {readMinutes > 0 && (
                  <>
                    <Box sx={s.dot} />
                    <Typography component="span" sx={s.meta}>{t('guides.readTime', { count: readMinutes })}</Typography>
                  </>
                )}
              </Box>
              <Typography variant="h1" sx={s.title}>{guide.title}</Typography>
              <Box sx={s.accentBar} />
            </Box>

            <Box sx={s.grid(showRail)}>
              <GlassCard sx={s.articleCard}>
                <Markdown content={guide.content} sx={s.prose} />
              </GlassCard>

              {showRail && (
                <Box component="aside" sx={s.sidebar}>
                  {tool && (
                    <GlassCard sx={s.toolCard}>
                      <Typography sx={s.toolOverline}>
                        <span aria-hidden="true">🔧 </span>
                        {t('guides.practiceTitle')}
                      </Typography>
                      <Typography sx={s.toolName}>{t(`tools.${tool.key}.tab`)}</Typography>
                      <Button
                        component={RouterLink}
                        to={`/outils/${tool.slug}`}
                        size="small"
                        variant="outlined"
                        fullWidth
                        endIcon={<ArrowForward />}
                        sx={{ mt: 1.5 }}
                      >
                        {t('guides.practiceCta')}
                      </Button>
                    </GlassCard>
                  )}
                  {showAd && <AdSlot width={300} height={250} />}
                </Box>
              )}
            </Box>
          </>
        )}
      </Box>
    </PageWrapper>
  );
}
