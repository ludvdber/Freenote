import { Box, Typography, List, ListItem, ListItemButton, ListItemText, Chip } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link as RouterLink } from 'react-router-dom';
import { getNews } from '@/api/endpoints';
import { formatDate } from '@/lib/utils';
import { STALE_15M } from '@/lib/constants';
import GlassCard from '@/components/ui/GlassCard';
import { MAIN_LINKS, SECONDARY_LINKS } from './NewsAndLinks.data';
import * as s from './NewsAndLinks.styles';

export default function NewsAndLinks() {
  const { t, i18n } = useTranslation();
  const { data: news } = useQuery({ queryKey: ['news'], queryFn: getNews, staleTime: STALE_15M });
  const hasNews = (news?.length ?? 0) > 0;

  return (
    <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      <Box sx={s.section}>
        <Box sx={s.flexRow}>
          {/* News column */}
          <Box sx={s.newsCol}>
            <Typography variant="h5" component="h2" sx={s.columnTitle}>
              <span aria-hidden="true">📰</span> {t('news.title')}
            </Typography>
            <GlassCard sx={s.newsCard}>
              {!hasNews && (
                <Box sx={s.newsEmptyWrapper}>
                  <Typography variant="body2">{t('news.empty')}</Typography>
                </Box>
              )}
              {hasNews && (
                <List dense sx={s.newsList}>
                  {news!.slice(0, 6).map((item, i) => (
                    <ListItem key={item.id ?? i} disablePadding>
                      <ListItemButton
                        component={RouterLink}
                        to={`/news/${item.id}`}
                        sx={s.newsItem}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body2" sx={s.newsTitle} noWrap>
                              {item.title}
                            </Typography>
                          }
                          secondary={item.date ? formatDate(item.date, i18n.language) : ''}
                        />
                        <Box sx={s.newsLabelsRow}>
                          {item.labels.slice(0, 2).map((label) => (
                            <Chip key={label} label={label} size="small" variant="outlined" sx={s.newsLabelChip} />
                          ))}
                          <Box sx={s.externalHint} aria-hidden="true">
                            <ChevronRight sx={{ fontSize: 16 }} />
                          </Box>
                        </Box>
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </GlassCard>
          </Box>

          {/* Links column */}
          <Box sx={s.linksCol}>
            <Typography variant="h5" component="h2" sx={s.columnTitle}>
              <span aria-hidden="true">🔗</span> {t('links.title')}
            </Typography>
            <GlassCard sx={s.linksCard}>
              <Box sx={s.mainLinksCol}>
                {MAIN_LINKS.map((link) => (
                  <Box
                    key={link.key}
                    component="a"
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t(`links.${link.key}`)}
                    sx={s.mainLinkRow(link.color)}
                  >
                    <Box sx={s.mainLinkIcon(link.color)} aria-hidden="true">
                      {link.icon}
                    </Box>
                    <Typography variant="body2" sx={s.mainLinkLabel}>
                      {t(`links.${link.key}`)}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Box sx={s.secondaryGrid}>
                {SECONDARY_LINKS.map((link) => (
                  <Box
                    key={link.key}
                    component="a"
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t(`links.${link.key}`)}
                    sx={s.secondaryLinkRow}
                  >
                    <Box aria-hidden="true" sx={{ display: 'flex' }}>
                      {link.icon}
                    </Box>
                    <Typography variant="caption" sx={s.secondaryLinkLabel}>
                      {t(`links.${link.key}`)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </GlassCard>
          </Box>
        </Box>
      </Box>
    </motion.section>
  );
}
