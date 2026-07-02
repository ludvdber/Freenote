import { useState } from 'react';
import {
  Box, Typography, Button, TextField, IconButton, Tooltip, Chip, Alert,
  FormControlLabel, Switch, ToggleButtonGroup, ToggleButton, CircularProgress,
} from '@mui/material';
import { Add, Edit, Delete, ArrowBack, Visibility, Code } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  adminListGuides, adminGetGuide, adminCreateGuide, adminUpdateGuide, adminDeleteGuide,
} from '@/api/endpoints';
import GlassCard from '@/components/ui/GlassCard';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Markdown from '@/components/common/Markdown';
import { extractApiError } from '@/lib/utils';
import type { GuideSummary } from '@/types';

export default function AdminGuides() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editorId, setEditorId] = useState<number | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GuideSummary | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['admin-guides'], queryFn: () => adminListGuides({ size: 100 }) });
  const guides = data?.content ?? [];

  const deleteMut = useMutation({
    mutationFn: () => adminDeleteGuide(deleteTarget!.id),
    onSuccess: () => {
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['admin-guides'] });
      qc.invalidateQueries({ queryKey: ['guides'] });
    },
  });

  if (editorId !== null) {
    return <GuideEditor id={editorId} onClose={() => setEditorId(null)} />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
          {t('admin.guides.title')} ({guides.length})
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setEditorId('new')}>
          {t('admin.guides.new')}
        </Button>
      </Box>

      {isLoading && <Typography color="text.secondary">{t('common.loading')}</Typography>}
      {!isLoading && guides.length === 0 && <Typography color="text.secondary">{t('admin.guides.empty')}</Typography>}

      {guides.map((g) => (
        <GlassCard key={g.id} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{g.title}</Typography>
              <Chip
                size="small"
                label={g.published ? t('admin.guides.published') : t('admin.guides.draft')}
                color={g.published ? 'success' : 'default'}
                variant={g.published ? 'filled' : 'outlined'}
                sx={{ height: 20 }}
              />
              {g.category && <Chip size="small" label={g.category} variant="outlined" sx={{ height: 20 }} />}
            </Box>
            <Typography variant="caption" color="text.secondary">/guides/{g.slug}</Typography>
          </Box>
          <Tooltip title={t('common.edit')}>
            <IconButton size="small" onClick={() => setEditorId(g.id)}><Edit fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title={t('common.delete')}>
            <IconButton size="small" color="error" onClick={() => setDeleteTarget(g)}><Delete fontSize="small" /></IconButton>
          </Tooltip>
        </GlassCard>
      ))}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('admin.guides.deleteTitle')}
        message={t('admin.guides.deleteConfirm', { title: deleteTarget?.title })}
        confirmLabel={t('common.delete')}
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}

/** Create / edit a guide. Free-form Markdown body with a live preview toggle. */
function GuideEditor({ id, onClose }: { id: number | 'new'; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isNew = id === 'new';

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');
  const [published, setPublished] = useState(false);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(isNew);

  // Load the full guide when editing (the list summary has no content body).
  const { isFetching } = useQuery({
    queryKey: ['admin-guide', id],
    queryFn: async () => {
      const g = await adminGetGuide(id as number);
      setTitle(g.title);
      setSummary(g.summary ?? '');
      setCategory(g.category ?? '');
      setContent(g.content);
      setPublished(g.published);
      setLoaded(true);
      return g;
    },
    enabled: !isNew,
    staleTime: 0,
  });

  const save = useMutation({
    mutationFn: () => {
      const body = { title: title.trim(), summary: summary.trim(), category: category.trim(), content, published };
      return isNew ? adminCreateGuide(body) : adminUpdateGuide(id as number, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-guides'] });
      qc.invalidateQueries({ queryKey: ['guides'] });
      qc.invalidateQueries({ queryKey: ['guide'] });
      onClose();
    },
    onError: (e: unknown) => setError(extractApiError(e)),
  });

  const canSave = title.trim().length > 0 && content.trim().length > 0 && !save.isPending;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button size="small" startIcon={<ArrowBack />} onClick={onClose}>{t('common.back')}</Button>
        <Box sx={{ flexGrow: 1 }} />
        <FormControlLabel
          control={<Switch checked={published} onChange={(e) => setPublished(e.target.checked)} />}
          label={t('admin.guides.publishedLabel')}
        />
        <Button variant="contained" onClick={() => save.mutate()} disabled={!canSave}>
          {save.isPending ? <CircularProgress size={20} color="inherit" /> : t('common.save')}
        </Button>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      {!isNew && isFetching && !loaded ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <>
          <GlassCard sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label={t('admin.guides.titleField')} value={title} onChange={(e) => setTitle(e.target.value)}
              fullWidth size="small" slotProps={{ htmlInput: { maxLength: 160 } }}
            />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label={t('admin.guides.category')} value={category} onChange={(e) => setCategory(e.target.value)}
                size="small" placeholder="Java" sx={{ width: 180 }} slotProps={{ htmlInput: { maxLength: 40 } }}
              />
              <TextField
                label={t('admin.guides.summary')} value={summary} onChange={(e) => setSummary(e.target.value)}
                size="small" fullWidth sx={{ flex: '1 1 280px' }} slotProps={{ htmlInput: { maxLength: 300 } }}
                helperText={t('admin.guides.summaryHelp')}
              />
            </Box>
          </GlassCard>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, flexGrow: 1 }}>{t('admin.guides.body')}</Typography>
            <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
              <ToggleButton value="edit"><Code fontSize="small" sx={{ mr: 0.5 }} /> {t('admin.guides.write')}</ToggleButton>
              <ToggleButton value="preview"><Visibility fontSize="small" sx={{ mr: 0.5 }} /> {t('admin.guides.preview')}</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {view === 'edit' ? (
            <>
              <TextField
                value={content} onChange={(e) => setContent(e.target.value)}
                fullWidth multiline minRows={16} placeholder={t('admin.guides.bodyPlaceholder')}
                slotProps={{ htmlInput: { maxLength: 50000, style: { fontFamily: '"JetBrains Mono", monospace', fontSize: 13.5 } } }}
              />
              <Typography variant="caption" color="text.secondary">{t('admin.guides.markdownHelp')}</Typography>
            </>
          ) : (
            <GlassCard sx={{ p: { xs: 2.5, md: 4 } }}>
              {content.trim()
                ? <Markdown content={content} sx={previewSx} />
                : <Typography color="text.secondary">{t('admin.guides.previewEmpty')}</Typography>}
            </GlassCard>
          )}
        </>
      )}
    </Box>
  );
}

// Minimal prose styling for the admin preview (the public page has the full GuideDetail.styles).
const previewSx = {
  lineHeight: 1.7,
  '& h1, & h2, & h3': { fontWeight: 700, mt: 2.5, mb: 1 },
  '& pre': { p: 2, borderRadius: 2, overflow: 'auto', bgcolor: '#0d1117', border: '1px solid rgba(255,255,255,0.08)' },
  '& pre code': { fontFamily: '"JetBrains Mono", monospace', fontSize: '0.85rem', color: '#c9d1d9', bgcolor: 'transparent' },
  '& code': { fontFamily: '"JetBrains Mono", monospace', fontSize: '0.875em' },
  '& a': { color: 'primary.main' },
  '& ul, & ol': { pl: 3 },
  '& img': { maxWidth: '100%', borderRadius: 2 },
} as const;
