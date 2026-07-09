import { useState } from 'react';
import { Box, Typography, IconButton, Tooltip, Alert } from '@mui/material';
import { Delete, Visibility } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getDuplicateGroups, adminDeleteDocument } from '@/api/endpoints';
import { formatDate } from '@/lib/utils';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import GlassCard from '@/components/ui/GlassCard';

/**
 * Doublons exacts (même hash SHA-256), détectés à l'upload + par le backfill. Écran dédié de la
 * sidebar « Modération » (ex-bloc d'AdminDocuments) : l'admin garde un exemplaire, supprime le reste.
 */
export default function AdminDuplicates() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [deleteCandidate, setDeleteCandidate] = useState<number | null>(null);

  const { data: duplicateGroups } = useQuery({
    queryKey: ['admin-duplicates'],
    queryFn: getDuplicateGroups,
  });

  const deleteMut = useMutation({
    mutationFn: adminDeleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {t('admin.docs.duplicates', { count: duplicateGroups?.length ?? 0 })}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t('admin.docs.duplicatesHint')}
      </Typography>

      {deleteMut.isError && (
        <Alert severity="error" onClose={() => deleteMut.reset()}>
          {(deleteMut.error as Error).message || t('common.error')}
        </Alert>
      )}

      {duplicateGroups && duplicateGroups.length === 0 && (
        <GlassCard sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">{t('admin.duplicates.empty')}</Typography>
        </GlassCard>
      )}

      {(duplicateGroups ?? []).map((group, gi) => (
        <GlassCard key={gi} sx={{ p: 2.5, borderColor: 'warning.main' }}>
          <Box sx={{ borderLeft: '3px solid', borderColor: 'warning.main', pl: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {group.map((doc) => (
              <Box key={doc.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{doc.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    #{doc.id} · {doc.courseName} · {doc.authorName} · {formatDate(doc.createdAt, i18n.language)}
                  </Typography>
                </Box>
                <Tooltip title={t('admin.docs.view')}>
                  <IconButton size="small" component={Link} to={`/documents/${doc.id}`} target="_blank">
                    <Visibility fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('document.delete')}>
                  <IconButton size="small" color="error" onClick={() => setDeleteCandidate(doc.id)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Box>
        </GlassCard>
      ))}

      <ConfirmDialog
        open={deleteCandidate !== null}
        title={t('document.delete')}
        message={t('admin.docs.deleteConfirm')}
        confirmLabel={t('common.confirm')}
        loading={deleteMut.isPending}
        onConfirm={() => {
          if (deleteCandidate !== null) deleteMut.mutate(deleteCandidate);
          setDeleteCandidate(null);
        }}
        onClose={() => setDeleteCandidate(null)}
      />
    </Box>
  );
}
