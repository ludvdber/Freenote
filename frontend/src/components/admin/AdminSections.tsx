import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  adminListSections,
  adminCreateSection,
  adminRenameSection,
  adminDeleteSection,
} from '@/api/endpoints';
import GlassCard from '@/components/ui/GlassCard';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { extractApiError } from '@/lib/utils';
import type { Section } from '@/types';

export default function AdminSections() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: sections, isLoading } = useQuery({
    queryKey: ['admin-sections'],
    queryFn: adminListSections,
  });

  const [createName, setCreateName] = useState('');
  const [createIcon, setCreateIcon] = useState('');
  const [editTarget, setEditTarget] = useState<Section | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Section | null>(null);
  const [error, setError] = useState('');

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-sections'] });
    qc.invalidateQueries({ queryKey: ['sections'] });
  };

  const createMut = useMutation({
    mutationFn: () => adminCreateSection(createName.trim(), createIcon.trim() || undefined),
    onSuccess: () => {
      setCreateName('');
      setCreateIcon('');
      setError('');
      invalidate();
    },
    onError: (e: unknown) => setError(extractApiError(e)),
  });

  const renameMut = useMutation({
    mutationFn: () => adminRenameSection(editTarget!.id, editName.trim(), editIcon.trim() || undefined),
    onSuccess: () => {
      setEditTarget(null);
      setError('');
      invalidate();
    },
    onError: (e: unknown) => setError(extractApiError(e)),
  });

  const deleteMut = useMutation({
    mutationFn: () => adminDeleteSection(deleteTarget!.id),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
    },
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {t('admin.sections.title')} ({sections?.length ?? 0})
      </Typography>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      <GlassCard sx={{ p: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          label={t('admin.sections.name')}
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          sx={{ flex: '1 1 200px' }}
        />
        <TextField
          size="small"
          label={t('admin.sections.icon')}
          placeholder="🎓"
          value={createIcon}
          onChange={(e) => setCreateIcon(e.target.value)}
          sx={{ width: 100 }}
        />
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => createMut.mutate()}
          disabled={!createName.trim() || createMut.isPending}
        >
          {t('admin.sections.create')}
        </Button>
      </GlassCard>

      {isLoading && <Typography color="text.secondary">{t('common.loading')}</Typography>}

      {sections?.map((s) => (
        <GlassCard key={s.id} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {s.icon ? `${s.icon} ` : ''}{s.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('admin.sections.docCount', { count: s.documentCount })}
            </Typography>
          </Box>
          <Tooltip title={t('admin.sections.rename')}>
            <IconButton
              size="small"
              onClick={() => {
                setEditTarget(s);
                setEditName(s.name);
                setEditIcon(s.icon ?? '');
              }}
            >
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('admin.sections.delete')}>
            <IconButton size="small" color="error" onClick={() => setDeleteTarget(s)}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </GlassCard>
      ))}

      <Dialog open={Boolean(editTarget)} onClose={() => setEditTarget(null)}>
        <DialogTitle>{t('admin.sections.renameTitle')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1, minWidth: 320 }}>
          <TextField
            autoFocus
            label={t('admin.sections.name')}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <TextField
            label={t('admin.sections.icon')}
            value={editIcon}
            onChange={(e) => setEditIcon(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTarget(null)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={() => renameMut.mutate()}
            disabled={!editName.trim() || renameMut.isPending}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('admin.sections.deleteTitle')}
        message={t('admin.sections.deleteConfirm', { name: deleteTarget?.name, count: deleteTarget?.documentCount })}
        confirmLabel={t('admin.sections.delete')}
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
