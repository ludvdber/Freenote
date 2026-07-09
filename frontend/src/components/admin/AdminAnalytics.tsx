import { useState } from 'react';
import { Box, Typography, ToggleButton, ToggleButtonGroup, Alert } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getAdminAnalytics, listGuides } from '@/api/endpoints';
import { TOOLS } from '@/pages/tools/toolsData';
import { STALE_15M } from '@/lib/constants';
import GlassCard from '@/components/ui/GlassCard';
import { KpiTile, DayBars, HBarList, TopList } from './charts';

/**
 * Page « Analytics » : mini-GA interne. Visites/outils/guides viennent du tracking anonyme
 * (daily_stats — vide tant que la version n'est pas déployée : bandeau « collecte en cours ») ;
 * tops quiz/docs viennent des compteurs déjà en base (all-time).
 */
export default function AdminAnalytics() {
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState(30);

  const { data } = useQuery({
    queryKey: ['admin-analytics', days],
    queryFn: () => getAdminAnalytics(days),
  });
  // Mapping slug → titre des guides (liste publique, déjà en cache ailleurs).
  const { data: guides } = useQuery({
    queryKey: ['guides', {}],
    queryFn: () => listGuides({ size: 100 }),
    staleTime: STALE_15M,
  });

  if (!data) return null;

  const toolName = (slug: string) => {
    const tool = TOOLS.find((td) => td.slug === slug);
    return tool ? t(`tools.${tool.key}.name`) : slug;
  };
  const guideTitle = (slug: string) =>
    guides?.content.find((g) => g.slug === slug)?.title ?? slug;
  const sourceLabel = (source: string) =>
    t(`admin.analytics.sources.${source}`, source);
  const fmtDay = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });

  const trackingEmpty = data.visits.value === 0 && data.visits.previous === 0;
  const vsLabel = t('admin.analytics.vsPrev', { days: data.days });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('admin.analytics.title')}</Typography>
        <ToggleButtonGroup size="small" exclusive value={days}
                           onChange={(_, v) => { if (v) setDays(v); }}>
          <ToggleButton value={30}>{t('admin.analytics.days30')}</ToggleButton>
          <ToggleButton value={90}>{t('admin.analytics.days90')}</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {trackingEmpty && <Alert severity="info">{t('admin.overview.trackingEmpty')}</Alert>}

      {/* KPI de la période */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)', xl: 'repeat(6, 1fr)' }, gap: 2 }}>
        <KpiTile label={t('admin.analytics.kpiVisits')} value={data.visits.value} previous={data.visits.previous} vsLabel={vsLabel} />
        <KpiTile label={t('admin.analytics.kpiDocViews')} value={data.docViews.value} previous={data.docViews.previous} vsLabel={vsLabel} />
        <KpiTile label={t('admin.analytics.kpiQuizPlays')} value={data.quizPlays.value} previous={data.quizPlays.previous} vsLabel={vsLabel} />
        <KpiTile label={t('admin.analytics.kpiGuideReads')} value={data.guideReads.value} previous={data.guideReads.previous} vsLabel={vsLabel} />
        <KpiTile label={t('admin.analytics.kpiToolUses')} value={data.toolUses.value} previous={data.toolUses.previous} vsLabel={vsLabel} />
        <KpiTile label={t('admin.analytics.kpiSignups')} value={data.signups.value} previous={data.signups.previous} vsLabel={vsLabel} />
      </Box>

      {/* Visites par jour */}
      <GlassCard sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
          {t('admin.analytics.visitsTitle', { days: data.days })}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {t('admin.overview.weekendLegend')}
        </Typography>
        <DayBars data={data.visitsByDay.map((d) => ({ day: d.day, count: d.count }))} height={110}
                 tooltip={(p) => `${fmtDay(p.day)} — ${t('admin.analytics.visitsTooltip', { count: p.count })}`} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary" className="mono">
            {data.visitsByDay.length > 0 ? fmtDay(data.visitsByDay[0].day) : ''}
          </Typography>
          <Typography variant="caption" color="text.secondary" className="mono">
            {data.visitsByDay.length > 0 ? fmtDay(data.visitsByDay[data.visitsByDay.length - 1].day) : ''}
          </Typography>
        </Box>
      </GlassCard>

      {/* Sources + outils */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
        <GlassCard sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            {t('admin.analytics.sourcesTitle')}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            {t('admin.analytics.sourcesHint')}
          </Typography>
          <HBarList rows={data.sources.map((r) => ({ label: sourceLabel(r.label), count: r.count }))}
                    emptyLabel={t('admin.analytics.empty')} />
        </GlassCard>
        <GlassCard sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
            {t('admin.analytics.toolsTitle')}
          </Typography>
          <HBarList rows={data.topTools.map((r) => ({ label: toolName(r.label), count: r.count }))}
                    emptyLabel={t('admin.analytics.empty')} />
        </GlassCard>
      </Box>

      {/* Tops contenus — disent quoi produire ensuite. */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2.5, alignItems: 'start' }}>
        <GlassCard sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
            {t('admin.analytics.topGuides')}
          </Typography>
          {/* label = slug tracké → le titre est résolu pour l'affichage, le slug fait le lien. */}
          <TopList rows={data.topGuides.map((r) => ({
                     label: guideTitle(r.label), count: r.count, to: `/guides/${r.label}`,
                   }))}
                   emptyLabel={t('admin.analytics.empty')} />
        </GlassCard>
        <GlassCard sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            {t('admin.analytics.topQuizzes')}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            {t('admin.analytics.allTime')}
          </Typography>
          <TopList rows={data.topQuizzes.map((r) => ({
                     ...r, to: r.id !== null ? `/outils/quiz#play=${r.id}` : undefined,
                   }))}
                   emptyLabel={t('admin.analytics.empty')} />
        </GlassCard>
        <GlassCard sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            {t('admin.analytics.topDocs')}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            {t('admin.analytics.allTime')}
          </Typography>
          <TopList rows={data.topDocs.map((r) => ({
                     ...r, to: r.id !== null ? `/documents/${r.id}` : undefined,
                   }))}
                   emptyLabel={t('admin.analytics.empty')} />
        </GlassCard>
      </Box>
    </Box>
  );
}
