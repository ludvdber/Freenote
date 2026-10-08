import { useState } from 'react';
import { Box, Typography, Button, Chip, Alert, LinearProgress } from '@mui/material';
import { CheckCircle, Cancel, Sync } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getSystemStatus, resyncSearchIndex } from '@/api/endpoints';
import { extractApiError, formatRelativeDate } from '@/lib/utils';
import GlassCard from '@/components/ui/GlassCard';

const GB = 1024 ** 3;
const MB = 1024 ** 2;

/** Au-delà, le disque ou le tas méritent qu'on s'en occupe (rouge). */
const USAGE_ALERT = 0.9;

/** Clé i18n + valeurs de la durée de fonctionnement, à l'unité la plus parlante. */
function uptime(seconds: number): [string, Record<string, number>] {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return ['admin.system.uptimeDays', { d, h }];
  return h > 0 ? ['admin.system.uptimeHours', { h, m }] : ['admin.system.uptimeMinutes', { m }];
}

function Gauge({ label, used, total, unit, divisor }: {
  label: string; used: number; total: number; unit: string; divisor: number;
}) {
  const ratio = total > 0 ? used / total : 0;
  return (
    <GlassCard sx={{ p: 2.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="h6" className="mono" sx={{ fontWeight: 700 }}>
        {(used / divisor).toFixed(1)} / {(total / divisor).toFixed(1)} {unit}
      </Typography>
      <LinearProgress variant="determinate" value={Math.min(100, ratio * 100)}
                      color={ratio > USAGE_ALERT ? 'error' : 'primary'} sx={{ mt: 1, height: 6, borderRadius: 3 }} />
    </GlassCard>
  );
}

/** Pane Système : services de données, index de recherche, JVM et disque. Rafraîchi toutes les 30 s. */
export default function AdminSystem() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);

  const { data: s, isLoading, isError } = useQuery({
    queryKey: ['admin-system'], queryFn: getSystemStatus, refetchInterval: 30_000,
  });

  const resyncMut = useMutation({
    mutationFn: resyncSearchIndex,
    onSuccess: () => {
      setFeedback({ severity: 'success', text: t('admin.system.resyncDone') });
      qc.invalidateQueries({ queryKey: ['admin-system'] });
    },
    onError: (e) => setFeedback({ severity: 'error', text: extractApiError(e) }),
  });

  if (isLoading) return <Typography color="text.secondary">{t('common.loading')}</Typography>;
  if (isError || !s) return <Alert severity="error">{t('admin.system.loadError')}</Alert>;

  const [uptimeKey, uptimeValues] = uptime(s.uptimeSeconds);
  const gap = s.indexedDocuments === null ? null : s.dbDocuments - s.indexedDocuments;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('admin.system.title')}</Typography>

      <Typography variant="body2" color="text.secondary">
        {t('admin.system.running', {
          version: s.version,
          since: formatRelativeDate(s.startedAt, i18n.language),
          uptime: t(uptimeKey, uptimeValues),
          java: s.javaVersion,
        })}
      </Typography>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
        {s.services.map((p) => (
          <GlassCard key={p.name} sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {p.up ? <CheckCircle color="success" /> : <Cancel color="error" />}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{t(`admin.system.services.${p.name}`)}</Typography>
              <Typography variant="caption" color={p.up ? 'text.secondary' : 'error'} className="mono">
                {p.up ? `${p.latencyMs} ms` : t('admin.system.down')}
              </Typography>
            </Box>
          </GlassCard>
        ))}
      </Box>

      <GlassCard sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>{t('admin.system.searchTitle')}</Typography>
          {gap === null ? (
            <Chip size="small" color="error" label={t('admin.system.searchDown')} />
          ) : gap === 0 ? (
            <Chip size="small" color="success" label={t('admin.system.searchSync')} />
          ) : (
            <Chip size="small" color="warning" label={t('admin.system.searchGap', { count: Math.abs(gap) })} />
          )}
          <Button size="small" variant="outlined" startIcon={<Sync />} disabled={resyncMut.isPending || gap === null}
                  onClick={() => resyncMut.mutate()}>
            {t('admin.system.resync')}
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('admin.system.searchCounts', { db: s.dbDocuments, indexed: s.indexedDocuments ?? '—' })}
        </Typography>
        {feedback && (
          <Alert severity={feedback.severity} onClose={() => setFeedback(null)} sx={{ mt: 1.5 }}>{feedback.text}</Alert>
        )}
      </GlassCard>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
        <Gauge label={t('admin.system.heap')} used={s.heapUsed} total={s.heapMax} unit={t('admin.system.unitMb')} divisor={MB} />
        <Gauge label={t('admin.system.disk')} used={s.diskTotal - s.diskFree} total={s.diskTotal} unit={t('admin.system.unitGb')} divisor={GB} />
      </Box>
      <Typography variant="caption" color="text.secondary">{t('admin.system.memoryHint')}</Typography>
    </Box>
  );
}
