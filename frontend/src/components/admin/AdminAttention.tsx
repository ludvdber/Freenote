import { useState } from 'react';
import { Box, Typography, Button, Chip, Alert } from '@mui/material';
import { MailOutlined, ContactPage } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { acknowledgeAlerts, getAdminAttention, sendOnboardingReminder } from '@/api/endpoints';
import { extractApiError, formatDate } from '@/lib/utils';
import GlassCard from '@/components/ui/GlassCard';
import AdminUserSheet from './AdminUserSheet';
import type { SmtpStatus } from '@/types';

/** Au-delà, la clé Brevo approche de sa désactivation (3 mois sans envoi). */
const SMTP_STALE_DAYS = 60;

function smtpSeverity(smtp: SmtpStatus): 'success' | 'warning' | 'error' {
  if (!smtp.keepAliveEnabled || smtp.daysSinceLastSent > SMTP_STALE_DAYS) return 'error';
  return smtp.daysSinceLastSent < 0 ? 'warning' : 'success';
}

/**
 * Haut de la vue d'ensemble : alertes système non vues, santé de l'envoi des mails et comptes
 * bloqués à l'inscription — les trois pannes silencieuses qui ont coûté des inscriptions.
 */
export default function AdminAttention() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);
  const [sheetUserId, setSheetUserId] = useState<number | null>(null);

  const { data } = useQuery({ queryKey: ['admin-attention'], queryFn: getAdminAttention, refetchInterval: 60_000 });

  const ackMut = useMutation({
    mutationFn: acknowledgeAlerts,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-attention'] }),
  });
  const remindMut = useMutation({
    mutationFn: sendOnboardingReminder,
    onSuccess: (result) => {
      setFeedback({ severity: result === 'SENT' ? 'success' : 'error', text: t(`admin.attention.remind${result}`) });
      qc.invalidateQueries({ queryKey: ['admin-attention'] });
    },
    onError: (e) => setFeedback({ severity: 'error', text: extractApiError(e) }),
  });

  if (!data) return null;
  const { smtp, systemAlerts, stuckAccounts } = data;
  const severity = smtpSeverity(smtp);
  const openLogs = (params: string) => navigate(`/admin?pane=logs&${params}`);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {systemAlerts > 0 && (
        <Alert
          severity="error"
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button color="inherit" size="small" onClick={() => openLogs('type=SYSTEM_ALERT')}>
                {t('admin.attention.alertsSee')}
              </Button>
              <Button color="inherit" size="small" disabled={ackMut.isPending} onClick={() => ackMut.mutate()}>
                {t('admin.attention.alertsAck')}
              </Button>
            </Box>
          }
        >
          {t('admin.attention.alerts', { count: systemAlerts })}
        </Alert>
      )}

      <Alert severity={severity} icon={<MailOutlined />}>
        {smtp.daysSinceLastSent < 0
          ? t('admin.attention.smtpNever')
          : t('admin.attention.smtpLast', { count: smtp.daysSinceLastSent })}
        {' · '}
        {smtp.keepAliveEnabled
          ? t('admin.attention.keepAliveOn', { days: smtp.thresholdDays })
          : t('admin.attention.keepAliveOff')}
      </Alert>

      {stuckAccounts.length > 0 && (
        <GlassCard sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {t('admin.attention.stuckTitle', { count: stuckAccounts.length })}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            {t('admin.attention.stuckHint')}
          </Typography>
          {feedback && (
            <Alert severity={feedback.severity} onClose={() => setFeedback(null)} sx={{ mb: 1.5 }}>
              {feedback.text}
            </Alert>
          )}
          {stuckAccounts.map((a) => (
            <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 1,
                                  borderTop: 1, borderColor: 'divider' }}>
              <Box sx={{ flex: 1, minWidth: 220 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {a.username}
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    {t('admin.attention.joined', { date: formatDate(a.createdAt) })}
                  </Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {!a.usernameChosen
                    ? t('admin.attention.stepUsername')
                    : a.lastEmailEvent
                      ? `${t(`admin.activity.types.${a.lastEmailEvent}`)} — ${a.lastEmailMessage ?? ''}`
                      : t('admin.attention.stepNoCode')}
                </Typography>
              </Box>
              {a.reminded && <Chip size="small" color="success" variant="outlined" label={t('admin.attention.reminded')} />}
              <Button size="small" startIcon={<ContactPage />} onClick={() => setSheetUserId(a.id)}>
                {t('admin.sheet.open')}
              </Button>
              <Button size="small" variant="outlined" disabled={a.reminded || remindMut.isPending}
                      onClick={() => remindMut.mutate(a.id)}>
                {t('admin.attention.remind')}
              </Button>
            </Box>
          ))}
        </GlassCard>
      )}

      <AdminUserSheet userId={sheetUserId} onClose={() => setSheetUserId(null)} />
    </Box>
  );
}
