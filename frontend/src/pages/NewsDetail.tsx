import { useParams, Link as RouterLink } from 'react-router-dom';
import { Typography, Box, Chip, Button, Divider } from '@mui/material';
import { ArrowBack, ArrowForward, OpenInNew } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import DOMPurify from 'dompurify';
import { getNews } from '@/api/endpoints';
import { SITE_URL, STALE_15M } from '@/lib/constants';
import { readingMinutes, stripHtml } from '@/lib/utils';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';
import { Thumb } from './News';
import * as s from './NewsDetail.styles';

export default function NewsDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { data: news } = useQuery({ queryKey: ['news'], queryFn: getNews, staleTime: STALE_15M });
  const item = news?.find((n) => n.id === id);

  // Navigation entre articles + « À lire ensuite » : le flux est déjà en cache React Query,
  // zéro requête supplémentaire. prev = plus récent, next = plus ancien (ordre du flux).
  const idx = news?.findIndex((n) => n.id === id) ?? -1;
  const prevItem = idx > 0 ? news![idx - 1] : null;
  const nextItem = idx >= 0 && idx < (news?.length ?? 0) - 1 ? news![idx + 1] : null;
  const readNext = idx >= 0 && news
    ? [...news.slice(idx + 1), ...news.slice(0, idx)].slice(0, 3)
    : [];

  // The feed content is third-party blog HTML → sanitized with DOMPurify before rendering.
  const cleanHtml = item?.content ? DOMPurify.sanitize(item.content) : '';
  const readMinutes = readingMinutes(item?.content);
  const excerpt = item?.content ? stripHtml(item.content).slice(0, 160) : '';

  const fullDate = item?.date
    ? new Date(item.date).toLocaleDateString(i18n.language.startsWith('fr') ? 'fr-BE' : 'en-GB', {
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

            {/* Navigation article précédent / suivant. */}
            {(prevItem || nextItem) && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 3 }}>
                {prevItem ? (
                  <Button
                    component={RouterLink}
                    to={`/news/${prevItem.id}`}
                    startIcon={<ArrowBack />}
                    size="small"
                    sx={{ maxWidth: '48%', justifyContent: 'flex-start', textAlign: 'left' }}
                  >
                    <Typography variant="caption" noWrap>{prevItem.title}</Typography>
                  </Button>
                ) : <Box />}
                {nextItem && (
                  <Button
                    component={RouterLink}
                    to={`/news/${nextItem.id}`}
                    endIcon={<ArrowForward />}
                    size="small"
                    sx={{ maxWidth: '48%', justifyContent: 'flex-end', textAlign: 'right' }}
                  >
                    <Typography variant="caption" noWrap>{nextItem.title}</Typography>
                  </Button>
                )}
              </Box>
            )}

            {/* « À lire ensuite » : remplit la zone vide sous l'article et garde le lecteur sur le site. */}
            {readNext.length > 0 && (
              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  {t('news.readNext')}
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                  {readNext.map((n) => {
                    const minutes = readingMinutes(n.content);
                    return (
                      <GlassCard
                        key={n.id}
                        component={RouterLink}
                        to={`/news/${n.id}`}
                        sx={{ p: 0, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}
                      >
                        {/* Même couverture que l'index, en miniature — les cartes texte nues détonnaient. */}
                        <Box sx={{ height: 72, position: 'relative', overflow: 'hidden', flexShrink: 0 }} aria-hidden="true">
                          <Thumb item={n} markSize={44} compact />
                        </Box>
                        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, flexGrow: 1 }}>
                          <Typography sx={{ fontWeight: 700, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {n.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto' }}>
                            {n.date && new Date(n.date).toLocaleDateString(i18n.language.startsWith('fr') ? 'fr-BE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {minutes > 0 && ` · ${t('news.readTime', { count: minutes })}`}
                          </Typography>
                        </Box>
                      </GlassCard>
                    );
                  })}
                </Box>
              </Box>
            )}
          </>
        )}
      </Box>
    </PageWrapper>
  );
}
