import { Typography, List, ListItemButton, ListItemText, Chip, Box } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Link as RouterLink } from 'react-router-dom';
import { getNews } from '@/api/endpoints';
import { formatDate } from '@/lib/utils';
import { SITE_URL, STALE_15M } from '@/lib/constants';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';
import AdSlot from '@/components/ui/AdSlot';

export default function News() {
  const { t, i18n } = useTranslation();
  const { data: news } = useQuery({ queryKey: ['news'], queryFn: getNews, staleTime: STALE_15M });

  return (
    <PageWrapper>
      <Helmet>
        <title>{`${t('nav.news')} · Freenote`}</title>
        <meta name="description" content={t('news.metaDescription')} />
        <link rel="canonical" href={`${SITE_URL}/news`} />
      </Helmet>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>{t('news.title')}</Typography>
      <GlassCard>
        <List>
          {news?.map((item, i) => (
            <ListItemButton key={item.id ?? i} component={RouterLink} to={`/news/${item.id}`}>
              <ListItemText primary={item.title} secondary={item.date ? formatDate(item.date, i18n.language) : ''} />
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {item.labels.map((label) => <Chip key={label} label={label} size="small" variant="outlined" />)}
              </Box>
            </ListItemButton>
          ))}
        </List>
      </GlassCard>
      <AdSlot width={728} height={90} sx={{ mt: 4 }} />
    </PageWrapper>
  );
}
