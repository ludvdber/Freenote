import { useDeferredValue, useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Button,
  MenuItem,
  TextField,
  Alert,
  Pagination,
} from '@mui/material';
import { DeleteSweep } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getActivityLogs, purgeActivityLogs } from '@/api/endpoints';
import { extractApiError } from '@/lib/utils';
import GlassCard from '@/components/ui/GlassCard';

type ChipColor = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';

const TYPE_COLORS: Record<string, ChipColor> = {
  LOGIN: 'info',
  SIGNUP: 'success',
  UPLOAD: 'primary',
  DOC_VERIFY: 'success',
  DOC_DELETE: 'warning',
  USER_BAN: 'error',
  EMAIL_CODE_SENT: 'info',
  EMAIL_CODE_BLOCKED: 'warning',
  EMAIL_SEND_FAILED: 'error',
  EMAIL_CODE_REJECTED: 'warning',
  EMAIL_VERIFIED: 'success',
  RATE_LIMITED: 'warning',
};

/** « EMAIL_* » = tout le parcours de vérification e-mail (famille de types côté serveur). */
const EMAIL_FAMILY = 'EMAIL_*';
const TYPES = [
  '', EMAIL_FAMILY, 'EMAIL_CODE_SENT', 'EMAIL_CODE_BLOCKED', 'EMAIL_SEND_FAILED', 'EMAIL_CODE_REJECTED',
  'EMAIL_VERIFIED', 'LOGIN', 'SIGNUP', 'UPLOAD', 'DOC_VERIFY', 'DOC_DELETE', 'USER_BAN', 'RATE_LIMITED',
];
const PURGE_OPTIONS = [7, 30, 90];

export default function AdminActivityLogs() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [type, setType] = useState('');
  const [actorInput, setActorInput] = useState('');
  // Le pseudo se tape lettre par lettre : la requête suit la valeur différée, pas chaque frappe.
  const actor = useDeferredValue(actorInput.trim());
  const [purgeDays, setPurgeDays] = useState(90);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-activity-logs', page, type, actor],
    queryFn: () => getActivityLogs(page, 50, type || undefined, actor || undefined),
  });

  const purgeMut = useMutation({
    mutationFn: () => purgeActivityLogs(purgeDays),
    onSuccess: (res) => {
      setInfo(t('admin.activity.purged', { count: res.deleted, days: purgeDays }));
      setError('');
      setPage(0);
      qc.invalidateQueries({ queryKey: ['admin-activity-logs'] });
    },
    onError: (e) => setError(extractApiError(e)),
  });

  const logs = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  const typeLabel = (ty: string) => {
    if (!ty) return t('admin.activity.allTypes');
    if (ty === EMAIL_FAMILY) return t('admin.activity.emailAll');
    return t(`admin.activity.types.${ty}`);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {t('admin.activity.title')}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t('admin.activity.subtitle')}
      </Typography>

      {info && <Alert severity="success" onClose={() => setInfo('')}>{info}</Alert>}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Filter + purge controls */}
      <GlassCard sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <TextField
          select
          size="small"
          label={t('admin.activity.filterType')}
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(0);
          }}
          sx={{ minWidth: 180 }}
        >
          {TYPES.map((ty) => (
            <MenuItem key={ty || 'all'} value={ty}>
              {typeLabel(ty)}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          size="small"
          label={t('admin.activity.filterActor')}
          value={actorInput}
          onChange={(e) => {
            setActorInput(e.target.value);
            setPage(0);
          }}
          sx={{ minWidth: 180 }}
        />

        <Box sx={{ flex: 1 }} />

        <TextField
          select
          size="small"
          label={t('admin.activity.purgeOlderThan')}
          value={purgeDays}
          onChange={(e) => setPurgeDays(Number(e.target.value))}
          sx={{ minWidth: 160 }}
        >
          {PURGE_OPTIONS.map((d) => (
            <MenuItem key={d} value={d}>
              {t('admin.activity.daysOption', { days: d })}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="outlined"
          color="warning"
          startIcon={<DeleteSweep />}
          disabled={purgeMut.isPending}
          onClick={() => purgeMut.mutate()}
        >
          {t('admin.activity.purge')}
        </Button>
      </GlassCard>

      {type.startsWith('EMAIL_') && (
        <Alert severity="info" variant="outlined">
          {t('admin.activity.emailHint')}
        </Alert>
      )}

      {isLoading && <Typography color="text.secondary">{t('common.loading')}</Typography>}
      {!isLoading && logs.length === 0 && (
        <GlassCard sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">{t('admin.activity.empty')}</Typography>
        </GlassCard>
      )}

      {logs.map((row) => (
        <GlassCard
          key={row.id}
          sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}
        >
          <Chip
            size="small"
            variant="outlined"
            color={TYPE_COLORS[row.type] ?? 'default'}
            label={t(`admin.activity.types.${row.type}`, row.type)}
            sx={{ minWidth: 104 }}
          />
          <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 120 }}>
            {row.actorName ?? '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 160 }}>
            {row.message}
          </Typography>
          <Typography variant="caption" color="text.secondary" className="mono">
            {new Date(row.createdAt).toLocaleString(i18n.language)}
          </Typography>
        </GlassCard>
      ))}

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
          <Pagination
            count={totalPages}
            page={page + 1}
            onChange={(_, p) => setPage(p - 1)}
            size="small"
          />
        </Box>
      )}
    </Box>
  );
}
