import { useState } from 'react';
import { Box, Typography, TextField, Button, Snackbar, Alert } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { adminGetCountdown, adminSetCountdown } from '@/api/endpoints';
import { daysUntil } from '@/lib/utils';
import GlassCard from '@/components/ui/GlassCard';

/**
 * Onglet « Réglages » : compte à rebours de la home (date + libellé). La bannière publique se
 * masque d'elle-même une fois la date passée — désactiver n'est utile que pour la retirer avant.
 */
export default function AdminSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: ['admin-countdown'], queryFn: adminGetCountdown });

  // Hydrate le formulaire à l'arrivée des données (render-adjust, pattern maison).
  const [prevData, setPrevData] = useState(data);
  if (data !== prevData) {
    setPrevData(data);
    setDate(data?.date ?? '');
    setLabel(data?.label ?? '');
  }

  const save = useMutation({
    mutationFn: (body: { date: string | null; label: string | null }) => adminSetCountdown(body),
    onSuccess: (r) => {
      queryClient.setQueryData(['admin-countdown'], r);
      queryClient.invalidateQueries({ queryKey: ['countdown'] });
      setFeedback(r.date ? t('admin.settings.saved') : t('admin.settings.disabled'));
    },
  });

  const days = date ? daysUntil(date) : null;

  return (
    <GlassCard sx={{ p: 3, maxWidth: 560 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
        {t('admin.settings.countdownTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        {t('admin.settings.countdownHint')}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <TextField
          type="date"
          size="small"
          label={t('admin.settings.dateLabel')}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 180 }}
        />
        <TextField
          size="small"
          label={t('admin.settings.labelLabel')}
          placeholder={t('admin.settings.labelPlaceholder')}
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, 60))}
          sx={{ minWidth: 240, flex: 1 }}
        />
      </Box>

      {date && days !== null && (
        <Typography variant="caption" color={days < 0 ? 'warning.main' : 'text.secondary'} sx={{ display: 'block', mb: 2 }}>
          {days < 0
            ? t('admin.settings.previewPast')
            : `${t('admin.settings.preview')} : 🎒 ${
                days === 0
                  ? t('home.countdown.today', { label: label || t('home.countdown.defaultLabel') })
                  : t('home.countdown.inDays', { label: label || t('home.countdown.defaultLabel'), count: days })
              }`}
        </Typography>
      )}

      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Button
          variant="contained"
          disabled={!date || save.isPending}
          onClick={() => save.mutate({ date, label: label.trim() || null })}
        >
          {t('common.save')}
        </Button>
        <Button
          variant="outlined"
          color="warning"
          disabled={save.isPending || !data?.date}
          onClick={() => { setDate(''); setLabel(''); save.mutate({ date: null, label: null }); }}
        >
          {t('admin.settings.disable')}
        </Button>
      </Box>

      <Snackbar open={feedback !== null} autoHideDuration={2500} onClose={() => setFeedback(null)}>
        <Alert severity="success" onClose={() => setFeedback(null)}>{feedback}</Alert>
      </Snackbar>
    </GlassCard>
  );
}
