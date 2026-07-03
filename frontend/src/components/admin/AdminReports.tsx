import { Box, Typography, Button, Chip } from '@mui/material';
import { CheckCircle, Cancel } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getPendingReports, resolveReport, dismissReport } from '@/api/endpoints';
import { formatDate } from '@/lib/utils';
import GlassCard from '@/components/ui/GlassCard';

export default function AdminReports() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-pending-reports'], queryFn: () => getPendingReports() });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-pending-reports'] });

  const resolveMut = useMutation({ mutationFn: resolveReport, onSuccess: invalidate });
  const dismissMut = useMutation({ mutationFn: dismissReport, onSuccess: invalidate });

  const reports = data?.content ?? [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {t('admin.reports.pending')} ({data?.totalElements ?? 0})
      </Typography>

      {isLoading && <Typography color="text.secondary">{t('common.loading')}</Typography>}
      {!isLoading && !reports.length && (
        <GlassCard sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">{t('admin.reports.noPending')}</Typography>
        </GlassCard>
      )}

      {reports.map((report) => (
        <GlassCard key={report.id} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Chip label={`#${report.documentId}`} size="small" variant="outlined" />
            <Typography
              component={Link}
              to={`/documents/${report.documentId}`}
              variant="body2"
              sx={{ fontWeight: 700, color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              {report.documentTitle}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              {report.reporterUsername} · {formatDate(report.createdAt, i18n.language)}
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 0.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1 }}>
            {report.reason}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button
              size="small"
              color="success"
              variant="contained"
              startIcon={<CheckCircle />}
              onClick={() => resolveMut.mutate(report.id)}
              disabled={resolveMut.isPending}
            >
              {t('admin.reports.resolve')}
            </Button>
            <Button
              size="small"
              color="inherit"
              variant="outlined"
              startIcon={<Cancel />}
              onClick={() => dismissMut.mutate(report.id)}
              disabled={dismissMut.isPending}
            >
              {t('admin.reports.dismiss')}
            </Button>
          </Box>
        </GlassCard>
      ))}
    </Box>
  );
}
