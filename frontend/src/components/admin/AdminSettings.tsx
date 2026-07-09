import { useState } from 'react';
import { Box, Typography, TextField, Button, Snackbar, Alert } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { adminGetCountdown, adminSetCountdown, adminGetFunding, adminSetFunding } from '@/api/endpoints';
import { daysUntil } from '@/lib/utils';
import GlassCard from '@/components/ui/GlassCard';

/**
 * Onglet « Réglages » : compte à rebours de la home (date + libellé) + thermomètre de financement
 * (coût mensuel du serveur). La bannière du compte à rebours se masque d'elle-même une fois la
 * date passée ; le thermomètre disparaît quand le coût est effacé.
 */
export default function AdminSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const [cost, setCost] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: ['admin-countdown'], queryFn: adminGetCountdown });
  const { data: funding } = useQuery({ queryKey: ['admin-funding'], queryFn: adminGetFunding });

  // Hydrate le formulaire à l'arrivée des données (render-adjust, pattern maison).
  const [prevData, setPrevData] = useState(data);
  if (data !== prevData) {
    setPrevData(data);
    setDate(data?.date ?? '');
    setLabel(data?.label ?? '');
  }
  const [prevFunding, setPrevFunding] = useState(funding);
  if (funding !== prevFunding) {
    setPrevFunding(funding);
    setCost(funding?.monthlyCost != null ? String(funding.monthlyCost) : '');
  }

  const save = useMutation({
    mutationFn: (body: { date: string | null; label: string | null }) => adminSetCountdown(body),
    onSuccess: (r) => {
      queryClient.setQueryData(['admin-countdown'], r);
      queryClient.invalidateQueries({ queryKey: ['countdown'] });
      setFeedback(r.date ? t('admin.settings.saved') : t('admin.settings.disabled'));
    },
  });

  const saveFunding = useMutation({
    mutationFn: (monthlyCost: number | null) => adminSetFunding(monthlyCost),
    onSuccess: (r) => {
      queryClient.setQueryData(['admin-funding'], r);
      queryClient.invalidateQueries({ queryKey: ['funding'] });
      setFeedback(r.monthlyCost != null ? t('admin.settings.saved') : t('admin.settings.disabled'));
    },
  });

  const days = date ? daysUntil(date) : null;
  const costNumber = Number(cost.replace(',', '.'));
  const costValid = cost !== '' && Number.isFinite(costNumber) && costNumber > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
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
      </GlassCard>

      {/* Thermomètre de financement : coût mensuel du serveur, jauge publique sur la home. */}
      <GlassCard sx={{ p: 3, maxWidth: 560 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
          {t('admin.settings.fundingTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          {t('admin.settings.fundingHint')}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
          <TextField
            size="small"
            label={t('admin.settings.fundingCostLabel')}
            placeholder="5"
            value={cost}
            onChange={(e) => setCost(e.target.value.replace(/[^\d.,]/g, '').slice(0, 8))}
            sx={{ width: 180 }}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
          {funding?.monthlyCost != null && (
            <Typography variant="caption" color="text.secondary">
              {t('admin.settings.fundingMonthTotal', { total: (funding.monthTotal ?? 0).toFixed(2) })}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="contained"
            disabled={!costValid || saveFunding.isPending}
            onClick={() => saveFunding.mutate(costNumber)}
          >
            {t('common.save')}
          </Button>
          <Button
            variant="outlined"
            color="warning"
            disabled={saveFunding.isPending || funding?.monthlyCost == null}
            onClick={() => { setCost(''); saveFunding.mutate(null); }}
          >
            {t('admin.settings.disable')}
          </Button>
        </Box>
      </GlassCard>

      <Snackbar open={feedback !== null} autoHideDuration={2500} onClose={() => setFeedback(null)}>
        <Alert severity="success" onClose={() => setFeedback(null)}>{feedback}</Alert>
      </Snackbar>
    </Box>
  );
}
