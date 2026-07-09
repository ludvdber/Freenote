import { Box, Typography, Button, Chip, Alert } from '@mui/material';
import { CheckCircle, OpenInNew, ArrowForward } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getAdminOverview,
  getPendingDocuments,
  getPendingReports,
  getActivityLogs,
  verifyDocument,
} from '@/api/endpoints';
import { formatDate } from '@/lib/utils';
import GlassCard from '@/components/ui/GlassCard';
import { KpiTile, DayBars, type DayPoint } from './charts';
import type { AdminPane } from '@/pages/Admin';

const QUEUE_DOCS = 4;
const QUEUE_REPORTS = 3;
const RECENT_LOGS = 8;

/**
 * Accueil « Mission Control » : répond en 10 secondes à « qu'est-ce qui se passe et qu'est-ce que
 * je dois faire ? » — KPI 7 j, activité 14 j (3 petites séries plutôt qu'un multi-séries illisible),
 * file « À traiter » actionnable et dernière activité.
 */
export default function AdminOverview({ onNavigate }: { onNavigate: (pane: AdminPane) => void }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const { data: overview } = useQuery({ queryKey: ['admin-overview'], queryFn: getAdminOverview });
  const { data: pendingDocs } = useQuery({
    queryKey: ['admin-pending-docs', 0],
    queryFn: () => getPendingDocuments(0, QUEUE_DOCS),
  });
  const { data: pendingReports } = useQuery({
    queryKey: ['admin-pending-reports-preview'],
    queryFn: () => getPendingReports(0, QUEUE_REPORTS),
  });
  const { data: recentLogs } = useQuery({
    queryKey: ['admin-recent-logs'],
    queryFn: () => getActivityLogs(0, RECENT_LOGS),
  });

  const verifyMut = useMutation({
    mutationFn: verifyDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-docs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });

  if (!overview) return null;

  const fmtDay = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
  const series = (key: 'visits' | 'docViews' | 'quizPlays'): DayPoint[] =>
    overview.activity14d.map((d) => ({ day: d.day, count: d[key] }));
  const total7 = (kpi: { value: number }) => kpi.value;

  const trackingEmpty = overview.visits7d.value === 0 && overview.visits7d.previous === 0;
  const queueTotal = overview.pendingDocs + overview.pendingReports + overview.duplicateGroups;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* KPI 7 jours */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
        <KpiTile label={t('admin.overview.kpiVisits')} value={overview.visits7d.value}
                 previous={overview.visits7d.previous} vsLabel={t('admin.overview.vsPrev')} />
        <KpiTile label={t('admin.overview.kpiDocViews')} value={overview.docViews7d.value}
                 previous={overview.docViews7d.previous} vsLabel={t('admin.overview.vsPrev')} />
        <KpiTile label={t('admin.overview.kpiQuizPlays')} value={overview.quizPlays7d.value}
                 previous={overview.quizPlays7d.previous} vsLabel={t('admin.overview.vsPrev')} />
        <KpiTile label={t('admin.overview.kpiSignups')} value={overview.signups7d.value}
                 previous={overview.signups7d.previous} vsLabel={t('admin.overview.vsPrev')} />
      </Box>

      {trackingEmpty && (
        <Alert severity="info">{t('admin.overview.trackingEmpty')}</Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, gap: 2.5, alignItems: 'start' }}>
        {/* Activité 14 jours — 3 petites séries (petits multiples : jamais de double axe). */}
        <GlassCard sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            {t('admin.overview.activityTitle')}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            {t('admin.overview.weekendLegend')}
          </Typography>
          {([
            ['visits', t('admin.overview.seriesVisits'), total7(overview.visits7d)],
            ['docViews', t('admin.overview.seriesDocViews'), total7(overview.docViews7d)],
            ['quizPlays', t('admin.overview.seriesQuizPlays'), total7(overview.quizPlays7d)],
          ] as const).map(([key, label, total]) => (
            <Box key={key} sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="caption" className="mono" color="text.secondary">
                  {t('admin.overview.sevenDayTotal', { count: total })}
                </Typography>
              </Box>
              <DayBars data={series(key)} height={44}
                       tooltip={(p) => `${fmtDay(p.day)} — ${p.count}`} />
            </Box>
          ))}
        </GlassCard>

        {/* Dernière activité (journal existant, 8 entrées). */}
        <GlassCard sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {t('admin.overview.recentTitle')}
            </Typography>
            <Button size="small" endIcon={<ArrowForward />} onClick={() => onNavigate('logs')}>
              {t('admin.overview.seeAll')}
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {(recentLogs?.content ?? []).map((log) => {
              const typeLabel = t(`admin.activity.types.${log.type}`, log.type);
              // Le message d'un LOGIN répète le libellé du type (« Connexion — Connexion ») : on ne
              // l'ajoute que s'il apporte autre chose.
              const detail = log.message && log.message !== typeLabel ? ` — ${log.message}` : '';
              return (
                <Box key={log.id} sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
                  <Typography variant="caption" color="text.secondary" className="mono" sx={{ flexShrink: 0 }}>
                    {formatDate(log.createdAt, i18n.language)}
                  </Typography>
                  <Typography variant="caption" noWrap title={`${log.actorName ?? ''} ${log.message ?? ''}`}>
                    <strong>{log.actorName ?? '—'}</strong> · {typeLabel}
                    {detail}
                  </Typography>
                </Box>
              );
            })}
            {recentLogs && recentLogs.content.length === 0 && (
              <Typography variant="caption" color="text.secondary">{t('admin.overview.recentEmpty')}</Typography>
            )}
          </Box>
        </GlassCard>
      </Box>

      {/* File « À traiter » : docs en attente actionnables + signalements + doublons. */}
      <GlassCard sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {t('admin.overview.queueTitle')}
          </Typography>
          <Chip size="small" color={queueTotal > 0 ? 'error' : 'success'} variant="outlined"
                label={queueTotal > 0
                  ? t('admin.overview.queueCount', { count: queueTotal })
                  : t('admin.overview.queueEmpty')} />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {(pendingDocs?.content ?? []).map((doc) => (
            <Box key={doc.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" variant="outlined" color="info" label={t('admin.overview.tagDoc')} />
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 180 }} title={doc.title}>
                <strong>{doc.title}</strong> — {doc.courseName} · {doc.authorName}
              </Typography>
              <Typography variant="caption" color="text.secondary" className="mono">
                {formatDate(doc.createdAt, i18n.language)}
              </Typography>
              <Button size="small" component={Link} to={`/documents/${doc.id}`} target="_blank"
                      startIcon={<OpenInNew />}>
                {t('admin.docs.view')}
              </Button>
              <Button size="small" variant="contained" color="success" startIcon={<CheckCircle />}
                      onClick={() => verifyMut.mutate(doc.id)} disabled={verifyMut.isPending}>
                {t('admin.docs.verify')}
              </Button>
            </Box>
          ))}

          {(pendingReports?.content ?? []).map((report) => (
            <Box key={report.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" variant="outlined" color="error" label={t('admin.overview.tagReport')} />
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 180 }} title={report.reason}>
                <strong>{report.documentTitle}</strong> — « {report.reason} »
              </Typography>
              <Button size="small" endIcon={<ArrowForward />} onClick={() => onNavigate('reports')}>
                {t('admin.overview.open')}
              </Button>
            </Box>
          ))}

          {overview.duplicateGroups > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" variant="outlined" color="warning" label={t('admin.overview.tagDuplicate')} />
              <Typography variant="body2" sx={{ flex: 1, minWidth: 180 }}>
                {t('admin.overview.duplicateLine', { count: overview.duplicateGroups })}
              </Typography>
              <Button size="small" endIcon={<ArrowForward />} onClick={() => onNavigate('duplicates')}>
                {t('admin.overview.open')}
              </Button>
            </Box>
          )}
        </Box>

        {overview.pendingDocs > QUEUE_DOCS && (
          <Button size="small" sx={{ mt: 1.5 }} endIcon={<ArrowForward />} onClick={() => onNavigate('documents')}>
            {t('admin.overview.allPendingDocs', { count: overview.pendingDocs })}
          </Button>
        )}
      </GlassCard>
    </Box>
  );
}
