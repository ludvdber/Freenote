import { useState } from 'react';
import { Box, Typography, Button, TextField, IconButton, Tooltip, Alert } from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { adminListProfessors, adminCreateProfessor, adminDeleteProfessor } from '@/api/endpoints';
import GlassCard from '@/components/ui/GlassCard';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { extractApiError } from '@/lib/utils';
import type { Professor } from '@/types';

export default function AdminProfessors() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Professor | null>(null);

  const { data: profs, isLoading } = useQuery({ queryKey: ['admin-professors'], queryFn: adminListProfessors });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-professors'] });
    queryClient.invalidateQueries({ queryKey: ['professors'] });
  };

  const createMut = useMutation({
    mutationFn: (name: string) => adminCreateProfessor(name),
    onSuccess: () => {
      setNewName('');
      setError('');
      invalidate();
    },
    onError: (e: unknown) => setError(extractApiError(e)),
  });

  const deleteMut = useMutation({
    mutationFn: () => adminDeleteProfessor(deleteTarget!.id),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e: unknown) => setError(extractApiError(e)),
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      <GlassCard sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          label={t('admin.profs.createLabel')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          sx={{ flex: 1, minWidth: 220 }}
        />
        <Button
          variant="contained"
          startIcon={<Add />}
          disabled={!newName.trim() || createMut.isPending}
          onClick={() => createMut.mutate(newName.trim())}
        >
          {t('admin.profs.create')}
        </Button>
      </GlassCard>

      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {t('admin.profs.all')} ({profs?.length ?? 0})
      </Typography>

      {isLoading && <Typography color="text.secondary">{t('common.loading')}</Typography>}
      {!isLoading && !profs?.length && (
        <GlassCard sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">{t('admin.profs.empty')}</Typography>
        </GlassCard>
      )}

      {profs?.map((prof) => (
        <GlassCard key={prof.id} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>{prof.name}</Typography>
          <Tooltip title={t('admin.profs.delete')}>
            <IconButton size="small" color="error" onClick={() => setDeleteTarget(prof)}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </GlassCard>
      ))}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('admin.profs.deleteTitle')}
        message={t('admin.profs.deleteConfirm', { name: deleteTarget?.name })}
        confirmLabel={t('admin.profs.delete')}
        confirmColor="error"
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
