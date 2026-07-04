import { useParams, Link as RouterLink } from 'react-router-dom';
import { Typography, Box, Chip, Button, Divider } from '@mui/material';
import { ArrowBack, OpenInNew } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import DOMPurify from 'dompurify';
import { getNews } from '@/api/endpoints';
import { SITE_URL, STALE_15M } from '@/lib/constants';
import { readingMinutes, stripHtml } from '@/lib/utils';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';
import * as s from './NewsDetail.styles';

export default function NewsDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { data: news } = useQuery({ queryKey: ['news'], queryFn: getNews, staleTime: STALE_15M });
  const item = news?.find((n) => n.id === id);

  // The feed content is third-party blog HTML → sanitized with DOMPurify before rendering.
  const cleanHtml = item?.content ? DOMPurify.sanitize(item.content) : '';
  const readMinutes = readingMinutes(item?.content);
  const excerpt = item?.content ? stripHtml(item.content).slice(0, 160) : '';

  const fullDate = item?.date
    ? new Date(item.date).toLocaleDateString(i18n.language === 'fr' ? 'fr-BE' : 'en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <PageWrapper>
      <Helmet>
        <title>{item ? `${item.title} · Freenote` : `${t('nav.news')} · Freenote`}</title>
        {excerpt && <meta name="description" content={excerpt} />}
        {item && <link rel="canonical" href={`${SITE_URL}/news/${item.id}`} />}
      </Helmet>

      <Box sx={s.article}>
        <Button component={RouterLink} to="/news" startIcon={<ArrowBack />} sx={s.backBtn}>
          {t('news.back')}
        </Button>

        {!item ? (
          <GlassCard sx={s.articleCard}>
            <Typography color="text.secondary">{t('news.notFound')}</Typography>
          </GlassCard>
        ) : (
          <>
            <Box component="header" sx={s.header}>
              <Box sx={s.eyebrow}>
                {item.labels.map((label) => (
                  <Chip key={label} label={label} size="small" variant="outlined" sx={s.chip} />
                ))}
                {fullDate && (
                  <>
                    {item.labels.length > 0 && <Box sx={s.dot} />}
                    <Typography component="span" sx={s.meta}>
                      {fullDate}
                    </Typography>
                  </>
                )}
                {readMinutes > 0 && (
                  <>
                    <Box sx={s.dot} />
                    <Typography component="span" sx={s.meta}>
                      {t('news.readTime', { count: readMinutes })}
                    </Typography>
                  </>
                )}
              </Box>
              <Typography variant="h1" sx={s.title}>
                {item.title}
              </Typography>
              <Box sx={s.accentBar} />
            </Box>

            {/* Pas de pub ici : le contenu est du HTML tiers (blog de l'école) — placer une
                annonce sur du contenu non original viole les policies AdSense. Les AdSlot
                restent sur /guides et /ressources (contenu original). */}
            <Box sx={s.grid(false)}>
              <GlassCard sx={s.articleCard}>
                {cleanHtml ? (
                  // Third-party HTML, sanitized with DOMPurify above before rendering.
                  <Box sx={s.prose} dangerouslySetInnerHTML={{ __html: cleanHtml }} />
                ) : (
                  <Typography color="text.secondary">{t('news.empty')}</Typography>
                )}

                {item.url && (
                  <>
                    <Divider sx={s.divider} />
                    <Button
                      component="a"
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      endIcon={<OpenInNew />}
                      variant="outlined"
                      size="small"
                      sx={s.sourceBtn}
                    >
                      {t('news.source')}
                    </Button>
                  </>
                )}
              </GlassCard>
            </Box>
          </>
        )}
      </Box>
    </PageWrapper>
  );
}
