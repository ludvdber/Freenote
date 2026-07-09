import { useState, lazy, Suspense } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Alert,
  Autocomplete,
  Pagination,
  Collapse,
} from '@mui/material';
import { CheckCircle, Edit, Delete, Save, Close, Visibility, PictureAsPdf } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getPendingDocuments,
  verifyDocument,
  adminUpdateDocument,
  adminDeleteDocument,
  searchDocuments,
  adminListCourses,
} from '@/api/endpoints';
import { formatDate } from '@/lib/utils';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { CATEGORIES, STALE_15M } from '@/lib/constants';
import { useDebounce } from '@/hooks/useDebounce';
import GlassCard from '@/components/ui/GlassCard';
import type { Course, DocumentResponse, UpdateDocumentRequest } from '@/types';

// Aperçu inline pour la modération : même viewer que DocumentView (lazy — pdf.js est lourd).
const PdfViewer = lazy(() => import('@/components/common/PdfViewer'));

const PAGE_SIZE = 10;

export default function AdminDocuments() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [page, setPage] = useState(0);
  const [prevSearch, setPrevSearch] = useState(debouncedSearch);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<UpdateDocumentRequest>({});
  const [deleteCandidate, setDeleteCandidate] = useState<number | null>(null);

  // Reset to page 0 whenever the search changes — otherwise we could land on a stale page
  // that no longer exists after the query narrows the result set. Adjusting state during
  // render (React's recommended pattern) instead of an effect avoids a cascading re-render.
  if (debouncedSearch !== prevSearch) {
    setPrevSearch(debouncedSearch);
    setPage(0);
  }

  const [pendingPage, setPendingPage] = useState(0);
  // Aperçu PDF inline (modération sans quitter la file) — un seul ouvert à la fois.
  const [previewDoc, setPreviewDoc] = useState<DocumentResponse | null>(null);
  const { data: pendingDocs } = useQuery({
    queryKey: ['admin-pending-docs', pendingPage],
    queryFn: () => getPendingDocuments(pendingPage, 20),
  });

  const { data: courses } = useQuery({
    queryKey: ['admin-courses-all'],
    queryFn: adminListCourses,
    staleTime: STALE_15M,
  });

  const { data: allDocs, isLoading } = useQuery({
    queryKey: ['admin-all-docs', debouncedSearch, page],
    queryFn: () => searchDocuments({ q: debouncedSearch || undefined, page, size: PAGE_SIZE }),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-pending-docs'] });
    queryClient.invalidateQueries({ queryKey: ['admin-all-docs'] });
    queryClient.invalidateQueries({ queryKey: ['admin-duplicates'] });
    // Les badges de la sidebar (docs en attente) doivent suivre immédiatement.
    queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
  };

  const verifyMut = useMutation({ mutationFn: verifyDocument, onSuccess: invalidateAll });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateDocumentRequest }) =>
      adminUpdateDocument(id, data),
    onSuccess: () => {
      invalidateAll();
      setEditingId(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: adminDeleteDocument,
    onSuccess: invalidateAll,
  });

  const startEdit = (doc: DocumentResponse) => {
    setEditingId(doc.id);
    setEditForm({
      title: doc.title,
      courseId: doc.courseId,
      category: doc.category,
      language: doc.language,
      year: doc.year ?? '',
      verified: doc.verified,
    });
  };

  const pendingCount = pendingDocs?.totalElements ?? 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Pending section */}
      {pendingCount > 0 && (
        <GlassCard sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
            {t('admin.docs.pending')} ({pendingCount})
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {pendingDocs!.content.map((doc) => (
              <Box key={doc.id} sx={{ borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, flexWrap: 'wrap' }}>
                  <Box sx={{ flex: 1, minWidth: 200 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{doc.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {doc.courseName} · {doc.authorName} · {formatDate(doc.createdAt, i18n.language)}
                    </Typography>
                  </Box>
                  {/* Aperçu PDF sur place — vérifier sans ouvrir 15 onglets. */}
                  <Tooltip title={t('admin.docs.preview')}>
                    <IconButton size="small"
                      color={previewDoc?.id === doc.id ? 'primary' : 'default'}
                      onClick={() => setPreviewDoc(previewDoc?.id === doc.id ? null : doc)}
                    >
                      <PictureAsPdf fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('admin.docs.view')}>
                    <IconButton size="small" component={Link} to={`/documents/${doc.id}`} target="_blank">
                      <Visibility fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Button size="small" variant="contained" color="success" startIcon={<CheckCircle />}
                    onClick={() => verifyMut.mutate(doc.id)} disabled={verifyMut.isPending}
                  >
                    {t('admin.docs.verify')}
                  </Button>
                  <Tooltip title={t('document.delete')}>
                    <IconButton size="small" color="error" onClick={() => setDeleteCandidate(doc.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Collapse in={previewDoc?.id === doc.id} unmountOnExit>
                  <Box sx={{ px: 1.5, pb: 1.5 }}>
                    <Suspense fallback={<Typography variant="caption" color="text.secondary">{t('common.loading')}</Typography>}>
                      {previewDoc?.id === doc.id && <PdfViewer docId={doc.id} title={doc.title} />}
                    </Suspense>
                  </Box>
                </Collapse>
              </Box>
            ))}
          </Box>
          {pendingDocs && pendingDocs.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Pagination
                count={pendingDocs.totalPages}
                page={pendingPage + 1}
                onChange={(_, p) => setPendingPage(p - 1)}
                color="primary"
                shape="rounded"
                size="small"
              />
            </Box>
          )}
        </GlassCard>
      )}

      {/* Les doublons exacts (même hash) vivent dans leur propre écran : sidebar → Doublons. */}

      {/* All documents search */}
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          {t('admin.docs.all')}
        </Typography>
        <TextField
          size="small"
          fullWidth
          placeholder={t('search.placeholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mb: 2 }}
        />
      </Box>

      {isLoading && <Typography color="text.secondary">{t('common.loading')}</Typography>}

      {updateMut.isError && (
        <Alert severity="error">{(updateMut.error as Error).message || t('common.error')}</Alert>
      )}
      {deleteMut.isError && (
        <Alert severity="error" onClose={() => deleteMut.reset()}>{(deleteMut.error as Error).message || t('common.error')}</Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {allDocs?.content.map((doc) => (
          <GlassCard key={doc.id} sx={{ p: 2 }}>
            {editingId === doc.id ? (
              <EditRow
                form={editForm}
                courses={courses ?? []}
                onChange={setEditForm}
                onSave={() => updateMut.mutate({ id: doc.id, data: editForm })}
                onCancel={() => setEditingId(null)}
                isPending={updateMut.isPending}
                t={t}
              />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{doc.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    #{doc.id} · {doc.courseName} · {doc.authorName} · {formatDate(doc.createdAt, i18n.language)}
                  </Typography>
                </Box>
                <Chip label={t(`categories.${doc.category}`)} size="small" variant="outlined" />
                {doc.verified && <Chip label={t('document.verified')} size="small" color="primary" variant="outlined" />}
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip title={t('admin.docs.view')}>
                    <IconButton size="small" component={Link} to={`/documents/${doc.id}`} target="_blank">
                      <Visibility fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('admin.docs.edit')}>
                    <IconButton size="small" onClick={() => startEdit(doc)}>
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('document.delete')}>
                    <IconButton size="small" color="error" onClick={() => setDeleteCandidate(doc.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            )}
          </GlassCard>
        ))}
      </Box>

      {allDocs && allDocs.totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: 2 }}>
          <Pagination
            count={allDocs.totalPages}
            page={page + 1}
            onChange={(_, p) => setPage(p - 1)}
            color="primary"
            shape="rounded"
          />
          <Typography variant="caption" color="text.secondary" className="mono">
            {allDocs.totalElements} docs
          </Typography>
        </Box>
      )}

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

interface EditRowProps {
  form: UpdateDocumentRequest;
  courses: Course[];
  onChange: (f: UpdateDocumentRequest) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
  t: (key: string) => string;
}

function EditRow({ form, courses, onChange, onSave, onCancel, isPending, t }: EditRowProps) {
  const selectedCourse = courses.find((c) => c.id === form.courseId) ?? null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          label={t('document.title')}
          size="small"
          value={form.title ?? ''}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
          sx={{ flex: 2, minWidth: 200 }}
        />
        <Autocomplete<Course, false, false, false>
          size="small"
          sx={{ flex: 2, minWidth: 240 }}
          options={courses}
          value={selectedCourse}
          onChange={(_, v) => onChange({ ...form, courseId: v?.id })}
          getOptionLabel={(c) => `${c.name} · ${c.sectionName}`}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={(params) => <TextField {...params} label={t('document.course')} />}
          renderOption={(props, c) => (
            <li {...props} key={c.id}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.name}</Typography>
                <Typography variant="caption" color="text.secondary">{c.sectionName}</Typography>
              </Box>
            </li>
          )}
        />
        <FormControl size="small" sx={{ flex: 1, minWidth: 120 }}>
          <InputLabel>{t('document.category')}</InputLabel>
          <Select
            value={form.category ?? ''}
            label={t('document.category')}
            onChange={(e) => onChange({ ...form, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <MenuItem key={c} value={c}>{t(`categories.${c}`)}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label={t('document.language')}
          size="small"
          value={form.language ?? ''}
          onChange={(e) => onChange({ ...form, language: e.target.value })}
          sx={{ width: 80 }}
        />
        <TextField
          label={t('document.year')}
          size="small"
          value={form.year ?? ''}
          onChange={(e) => onChange({ ...form, year: e.target.value })}
          sx={{ width: 100 }}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button size="small" onClick={onCancel} startIcon={<Close />}>{t('common.cancel')}</Button>
        <Button size="small" variant="contained" onClick={onSave} startIcon={<Save />} disabled={isPending}>
          {isPending ? t('common.loading') : t('common.save')}
        </Button>
      </Box>
    </Box>
  );
}
