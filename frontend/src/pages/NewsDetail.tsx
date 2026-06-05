import { useParams, Link as RouterLink } from 'react-router-dom';
import { Typography, Box, Chip, Button } from '@mui/material';
import { ArrowBack, OpenInNew } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import DOMPurify from 'dompurify';
import { getNews } from '@/api/endpoints';
import { formatRelativeDate } from '@/lib/utils';
import { STALE_15M } from '@/lib/constants';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';

export default function NewsDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { data: news } = useQuery({ queryKey: ['news'], queryFn: getNews, staleTime: STALE_15M });
  const item = news?.find((n) => n.id === id);

  return (
    <PageWrapper>
      <Helmet>
        <title>{item ? `${item.title} — Freenote` : `${t('nav.news')} — Freenote`}</title>
      </Helmet>

      <Button component={RouterLink} to="/news" startIcon={<ArrowBack />} sx={{ mb: 2 }}>
        {t('news.back')}
      </Button>

      {!item ? (
        <Typography color="text.secondary">{t('news.notFound')}</Typography>
      ) : (
        <GlassCard>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            {item.title}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
            {item.date && (
              <Typography variant="body2" color="text.secondary">
                {formatRelativeDate(item.date, i18n.language)}
              </Typography>
            )}
            {item.labels.map((label) => (
              <Chip key={label} label={label} size="small" variant="outlined" />
            ))}
          </Box>

          {item.content && (
            // The feed content is third-party HTML → sanitized with DOMPurify before rendering.
            <Box
              sx={{
                lineHeight: 1.7,
                '& img': { maxWidth: '100%', height: 'auto', borderRadius: 1, my: 1 },
                '& a': { color: 'primary.main' },
                '& iframe': { maxWidth: '100%' },
              }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.content) }}
            />
          )}

          {item.url && (
            <Button
              component="a"
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNew />}
              size="small"
              sx={{ mt: 3 }}
            >
              {t('news.source')}
            </Button>
          )}
        </GlassCard>
      )}
    </PageWrapper>
  );
}
