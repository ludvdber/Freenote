import { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Autocomplete,
  Chip,
} from '@mui/material';
import { Add, Edit, Delete, Link as LinkIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  adminListCourses,
  adminCreateCourse,
  adminRenameCourse,
  adminDeleteCourse,
  adminGetCourseEquivalents,
  adminSetCourseEquivalents,
  getSections,
} from '@/api/endpoints';
import { STALE_15M } from '@/lib/constants';
import GlassCard from '@/components/ui/GlassCard';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { extractApiError } from '@/lib/utils';
import type { Course } from '@/types';

export default function AdminCourses() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: courses, isLoading } = useQuery({
    queryKey: ['admin-courses'],
    queryFn: adminListCourses,
  });
  const { data: sections } = useQuery({
    queryKey: ['sections'],
    queryFn: getSections,
    staleTime: STALE_15M,
  });

  const [createName, setCreateName] = useState('');
  const [createSectionId, setCreateSectionId] = useState<number | ''>('');
  const [filterSectionId, setFilterSectionId] = useState<number | 'all'>('all');
  const [editTarget, setEditTarget] = useState<Course | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [linkTarget, setLinkTarget] = useState<Course | null>(null);
  const [linkSelection, setLinkSelection] = useState<Course[]>([]);
  const [error, setError] = useState('');

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-courses'] });
    qc.invalidateQueries({ queryKey: ['courses'] });
  };

  const filtered = useMemo(() => {
    if (!courses) return [];
    return courses.filter((c) => filterSectionId === 'all' || c.sectionId === filterSectionId);
  }, [courses, filterSectionId]);

  const createMut = useMutation({
    mutationFn: () => adminCreateCourse({ name: createName.trim(), sectionId: createSectionId as number }),
    onSuccess: () => {
      setCreateName('');
      setError('');
      invalidate();
    },
    onError: (e: unknown) => setError(extractApiError(e)),
  });

  const renameMut = useMutation({
    mutationFn: () => adminRenameCourse(editTarget!.id, editName.trim()),
    onSuccess: () => {
      setEditTarget(null);
      setError('');
      invalidate();
    },
    onError: (e: unknown) => setError(extractApiError(e)),
  });

  const deleteMut = useMutation({
    mutationFn: () => adminDeleteCourse(deleteTarget!.id),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
    },
  });

  // Équivalences (V15) : pré-remplit le dialog avec les cours déjà liés.
  const openLink = async (c: Course) => {
    setLinkTarget(c);
    setLinkSelection([]);
    try {
      setLinkSelection(await adminGetCourseEquivalents(c.id));
    } catch (e) {
      setError(extractApiError(e));
    }
  };

  const linkMut = useMutation({
    mutationFn: () => adminSetCourseEquivalents(linkTarget!.id, linkSelection.map((c) => c.id)),
    onSuccess: () => {
      setLinkTarget(null);
      setError('');
      invalidate();
    },
    onError: (e: unknown) => setError(extractApiError(e)),
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {t('admin.courses.title')} ({filtered.length})
      </Typography>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      <GlassCard sx={{ p: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          label={t('admin.courses.name')}
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          sx={{ flex: '1 1 200px' }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>{t('admin.courses.section')}</InputLabel>
          <Select
            value={createSectionId}
            label={t('admin.courses.section')}
            onChange={(e) => setCreateSectionId(e.target.value as number)}
          >
            {sections?.map((sec) => (
              <MenuItem key={sec.id} value={sec.id}>{sec.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => createMut.mutate()}
          disabled={!createName.trim() || createSectionId === '' || createMut.isPending}
        >
          {t('admin.courses.create')}
        </Button>
      </GlassCard>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>{t('admin.courses.filterSection')}</InputLabel>
          <Select
            value={filterSectionId}
            label={t('admin.courses.filterSection')}
            onChange={(e) => setFilterSectionId(e.target.value as number | 'all')}
          >
            <MenuItem value="all">{t('admin.courses.allSections')}</MenuItem>
            {sections?.map((sec) => (
              <MenuItem key={sec.id} value={sec.id}>{sec.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {isLoading && <Typography color="text.secondary">{t('common.loading')}</Typography>}

      {filtered.map((c) => (
        <GlassCard key={c.id} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{c.name}</Typography>
              {c.equivalenceGroup != null && (
                <Tooltip title={t('admin.courses.linkedTip')}>
                  <Chip size="small" label={`≈ ${t('admin.courses.linkedChip')}`} color="info" variant="outlined" />
                </Tooltip>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {c.sectionName} · {t('admin.courses.docCount', { count: c.documentCount })}
            </Typography>
          </Box>
          <Tooltip title={t('admin.courses.equivalents')}>
            <IconButton size="small" onClick={() => void openLink(c)}>
              <LinkIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('admin.courses.rename')}>
            <IconButton size="small" onClick={() => { setEditTarget(c); setEditName(c.name); }}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('admin.courses.delete')}>
            <IconButton size="small" color="error" onClick={() => setDeleteTarget(c)}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </GlassCard>
      ))}

      <Dialog open={Boolean(editTarget)} onClose={() => setEditTarget(null)}>
        <DialogTitle>{t('admin.courses.renameTitle')}</DialogTitle>
        <DialogContent sx={{ minWidth: 320, pt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            label={t('admin.courses.name')}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTarget(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={() => renameMut.mutate()} disabled={!editName.trim() || renameMut.isPending}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(linkTarget)} onClose={() => setLinkTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t('admin.courses.equivalentsTitle', { name: linkTarget?.name })}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('admin.courses.equivalentsHelp')}
          </Typography>
          <Autocomplete
            multiple
            options={(courses ?? []).filter((c) => c.id !== linkTarget?.id)}
            value={linkSelection}
            onChange={(_, value) => setLinkSelection(value)}
            getOptionLabel={(c) => `${c.name} (${c.sectionName})`}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            renderInput={(params) => (
              <TextField {...params} label={t('admin.courses.equivalents')} placeholder={t('admin.courses.equivalentsPlaceholder')} />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkTarget(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={() => linkMut.mutate()} disabled={linkMut.isPending}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('admin.courses.deleteTitle')}
        message={t('admin.courses.deleteConfirm', { name: deleteTarget?.name, count: deleteTarget?.documentCount })}
        confirmLabel={t('admin.courses.delete')}
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
