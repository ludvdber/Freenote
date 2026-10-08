import { useState } from 'react';
import {
  Box, Typography, Button, Chip, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Divider,
} from '@mui/material';
import { ReceiptLong } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  cancelVerificationCode, clearUserRateLimits, getUserSupport, resetVerificationAttempts, sendOnboardingReminder,
} from '@/api/endpoints';
import { extractApiError, formatRelativeDate } from '@/lib/utils';

const MAX_CODE_ATTEMPTS = 5;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, py: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 150, flexShrink: 0 }}>{label}</Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

/**
 * Fiche « support » d'un compte : où en est son inscription et ce qui le bloque, avec les
 * déblocages à portée de main (annuler le code, remettre les essais, lever les limites).
 */
export default function AdminUserSheet({ userId, onClose }: { userId: number | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);

  const { data: s, isLoading } = useQuery({
    queryKey: ['admin-user-support', userId],
    queryFn: () => getUserSupport(userId!),
    enabled: userId !== null,
  });

  const done = (text: string) => {
    setFeedback({ severity: 'success', text });
    qc.invalidateQueries({ queryKey: ['admin-user-support', userId] });
    qc.invalidateQueries({ queryKey: ['admin-attention'] });
  };
  const fail = (e: unknown) => setFeedback({ severity: 'error', text: extractApiError(e) });

  const cancelMut = useMutation({
    mutationFn: cancelVerificationCode, onSuccess: () => done(t('admin.sheet.codeCancelled')), onError: fail,
  });
  const attemptsMut = useMutation({
    mutationFn: resetVerificationAttempts, onSuccess: () => done(t('admin.sheet.attemptsReset')), onError: fail,
  });
  const limitsMut = useMutation({
    mutationFn: clearUserRateLimits, onSuccess: () => done(t('admin.sheet.limitsCleared')), onError: fail,
  });
  const remindMut = useMutation({
    mutationFn: sendOnboardingReminder,
    onSuccess: (result) => {
      if (result === 'SENT') done(t('admin.attention.remindSENT'));
      else setFeedback({ severity: 'error', text: t(`admin.attention.remind${result}`) });
    },
    onError: fail,
  });

  const close = () => {
    setFeedback(null);
    onClose();
  };
  const when = (date: string) => formatRelativeDate(date, i18n.language);
  const busy = cancelMut.isPending || attemptsMut.isPending || limitsMut.isPending || remindMut.isPending;

  const step = !s ? '' : s.verified
    ? t('admin.sheet.stepDone')
    : !s.usernameChosen ? t('admin.attention.stepUsername')
      : s.pendingCode ? t('admin.sheet.stepCode')
        : t('admin.sheet.stepEmail');

  return (
    <Dialog open={userId !== null} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>{s ? s.username : t('admin.sheet.title')}</DialogTitle>
      <DialogContent dividers>
        {isLoading && <Typography color="text.secondary">{t('common.loading')}</Typography>}
        {feedback && (
          <Alert severity={feedback.severity} onClose={() => setFeedback(null)} sx={{ mb: 1.5 }}>{feedback.text}</Alert>
        )}
        {s && (
          <>
            <Row label={t('admin.sheet.joined')}>
              <Typography variant="body2">{when(s.createdAt)}</Typography>
            </Row>
            <Row label={t('admin.sheet.lastLogin')}>
              <Typography variant="body2">{s.lastLoginAt ? when(s.lastLoginAt) : t('admin.sheet.noLogin')}</Typography>
            </Row>
            <Row label={t('admin.sheet.step')}>
              <Chip size="small" color={s.verified ? 'success' : 'warning'} label={step} />
              {!s.termsAccepted && s.verified && (
                <Chip size="small" variant="outlined" label={t('admin.sheet.termsPending')} sx={{ ml: 1 }} />
              )}
            </Row>
            <Row label={t('admin.sheet.lastEmail')}>
              {s.lastEmailEvent ? (
                <Typography variant="body2">
                  {t(`admin.activity.types.${s.lastEmailEvent}`)} · {when(s.lastEmailEventAt!)}
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {s.lastEmailMessage}
                  </Typography>
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">{t('admin.attention.stepNoCode')}</Typography>
              )}
            </Row>

            <Divider sx={{ my: 1.5 }} />

            <Row label={t('admin.sheet.code')}>
              {s.pendingCode ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
                  <Typography variant="body2">
                    {t('admin.sheet.codePending', {
                      minutes: Math.max(1, Math.ceil(s.pendingCode.expiresInSeconds / 60)),
                      attempts: s.pendingCode.attempts,
                      max: MAX_CODE_ATTEMPTS,
                    })}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button size="small" variant="outlined" color="warning" disabled={busy}
                            onClick={() => cancelMut.mutate(s.id)}>
                      {t('admin.sheet.cancelCode')}
                    </Button>
                    {s.pendingCode.attempts > 0 && (
                      <Button size="small" variant="outlined" disabled={busy} onClick={() => attemptsMut.mutate(s.id)}>
                        {t('admin.sheet.resetAttempts')}
                      </Button>
                    )}
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">{t('admin.sheet.noCode')}</Typography>
              )}
            </Row>

            <Row label={t('admin.sheet.limits')}>
              {s.rateLimits.length ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                  {s.rateLimits.map((l) => (
                    <Typography key={l.endpoint} variant="body2">
                      <span className="mono">{l.endpoint}</span>
                      {' · '}
                      {t('admin.sheet.limitLine', {
                        count: l.count, minutes: Math.max(1, Math.ceil(l.retryAfterSeconds / 60)),
                      })}
                    </Typography>
                  ))}
                  <Button size="small" variant="outlined" disabled={busy} onClick={() => limitsMut.mutate(s.id)}>
                    {t('admin.sheet.clearLimits')}
                  </Button>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">{t('admin.sheet.noLimits')}</Typography>
              )}
            </Row>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        {s && !s.verified && s.discordLinked && (
          <Button disabled={s.reminded || busy} onClick={() => remindMut.mutate(s.id)}>
            {s.reminded ? t('admin.attention.reminded') : t('admin.attention.remind')}
          </Button>
        )}
        {s && (
          <Button startIcon={<ReceiptLong />}
                  onClick={() => { close(); navigate(`/admin?pane=logs&q=${encodeURIComponent(s.username)}`); }}>
            {t('admin.attention.journal')}
          </Button>
        )}
        <Button onClick={close}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
