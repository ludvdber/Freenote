import { Typography, Box, Chip } from '@mui/material';
import { ArrowForward, Article as ArticleIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Link as RouterLink } from 'react-router-dom';
import type { NewsItem } from '@/types';
import { getNews } from '@/api/endpoints';
import { formatDate, readingMinutes, stripHtml } from '@/lib/utils';
import { SITE_URL, STALE_15M } from '@/lib/constants';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';
import AdSlot from '@/components/ui/AdSlot';
import * as s from './News.styles';

function Thumb({ item }: { item: NewsItem }) {
  if (item.thumbnail) {
    return (
      <Box className="news-media" sx={{ width: '100%', height: '100%' }}>
        <Box component="img" src={item.thumbnail} alt="" loading="lazy" sx={s.img} />
      </Box>
    );
  }
  // Deterministic gradient variant from the post id so imageless cards aren't all identical.
  const seed = [...item.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <Box sx={s.placeholder(seed)} aria-hidden="true">
      <ArticleIcon />
    </Box>
  );
}

function MetaLine({ item }: { item: NewsItem }) {
  const { t, i18n } = useTranslation();
  const minutes = readingMinutes(item.content);
  return (
    <Box sx={s.eyebrow}>
      {item.labels.slice(0, 2).map((label) => (
        <Chip key={label} label={label} size="small" variant="outlined" sx={s.chip} />
      ))}
      {item.date && (
        <>
          {item.labels.length > 0 && <Box sx={s.dot} />}
          <Typography component="span" sx={s.meta}>{formatDate(item.date, i18n.language)}</Typography>
        </>
      )}
      {minutes > 0 && (
        <>
          <Box sx={s.dot} />
          <Typography component="span" sx={s.meta}>{t('news.readTime', { count: minutes })}</Typography>
        </>
      )}
    </Box>
  );
}

export default function News() {
  const { t } = useTranslation();
  const { data: news, isLoading } = useQuery({ queryKey: ['news'], queryFn: getNews, staleTime: STALE_15M });

  const items = news ?? [];
  const [hero, ...rest] = items;
  const heroExcerpt = hero?.content ? stripHtml(hero.content).slice(0, 220) : '';

  return (
    <PageWrapper>
      <Helmet>
        <title>{`${t('nav.news')} · Freenote`}</title>
        <meta name="description" content={t('news.metaDescription')} />
        <link rel="canonical" href={`${SITE_URL}/news`} />
      </Helmet>

      <Typography variant="h4" component="h1" sx={s.title}>{t('news.title')}</Typography>
      <Typography component="p" sx={s.subtitle}>{t('news.subtitle')}</Typography>

      {!isLoading && items.length === 0 && (
        <GlassCard sx={s.emptyCard}>
          <Typography color="text.secondary">{t('news.empty')}</Typography>
        </GlassCard>
      )}

      {hero && (
        <GlassCard component={RouterLink} to={`/news/${hero.id}`} sx={s.hero}>
          <Box sx={s.heroMedia}><Thumb item={hero} /></Box>
          <Box sx={s.heroBody}>
            <Box sx={s.heroEyebrow}>
              <Chip label={t('news.latest')} size="small" sx={s.chip} />
              <MetaLine item={hero} />
            </Box>
            <Typography component="h2" sx={s.heroTitle}>{hero.title}</Typography>
            <Box sx={s.accentBar} />
            {heroExcerpt && <Typography sx={s.heroExcerpt}>{heroExcerpt}</Typography>}
            <Box sx={s.heroCta}>{t('news.readMore')} <ArrowForward fontSize="small" /></Box>
          </Box>
        </GlassCard>
      )}

      {rest.length > 0 && (
        <>
          <Typography component="h2" sx={s.sectionLabel}>{t('news.more')}</Typography>
          <Box sx={s.grid}>
            {rest.map((item) => (
              <GlassCard key={item.id} component={RouterLink} to={`/news/${item.id}`} sx={s.card}>
                <Box sx={s.cardMedia}><Thumb item={item} /></Box>
                <Box sx={s.cardBody}>
                  <MetaLine item={item} />
                  <Typography component="h3" sx={s.cardTitle}>{item.title}</Typography>
                </Box>
              </GlassCard>
            ))}
          </Box>
        </>
      )}

      <AdSlot width={728} height={90} sx={{ mt: 5 }} />
    </PageWrapper>
  );
}
