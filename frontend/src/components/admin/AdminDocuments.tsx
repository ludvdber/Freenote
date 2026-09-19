import { useState, lazy, Suspense } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  TextField,
  IconButton,
  Tooltip,
  Alert,
  Pagination,
  Collapse,
} from '@mui/material';
import { CheckCircle, Edit, Delete, Visibility, PictureAsPdf } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getPendingDocuments,
  verifyDocument,
  adminDeleteDocument,
  searchDocuments,
} from '@/api/endpoints';
import { formatDate } from '@/lib/utils';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import DocumentEditDialog from '@/components/common/DocumentEditDialog';
import { useDebounce } from '@/hooks/useDebounce';
import GlassCard from '@/components/ui/GlassCard';
import type { DocumentResponse } from '@/types';

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
  // Édition : la fiche partagée avec la page du document (elle seule expose l'interrupteur
  // « Vérifié » et le professeur, absents de l'ancien formulaire en ligne).
  const [editDoc, setEditDoc] = useState<DocumentResponse | null>(null);
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

  const deleteMut = useMutation({
    mutationFn: adminDeleteDocument,
    onSuccess: invalidateAll,
  });

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
                  {/* Corriger AVANT de vérifier : jusqu'ici il fallait vérifier, puis retrouver le
                      document dans la liste « Tous » par recherche texte pour l'éditer. */}
                  <Tooltip title={t('admin.docs.edit')}>
                    <IconButton size="small" onClick={() => setEditDoc(doc)}>
                      <Edit fontSize="small" />
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

      {deleteMut.isError && (
        <Alert severity="error" onClose={() => deleteMut.reset()}>{(deleteMut.error as Error).message || t('common.error')}</Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {allDocs?.content.map((doc) => (
          <GlassCard key={doc.id} sx={{ p: 2 }}>
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
                    <IconButton size="small" onClick={() => setEditDoc(doc)}>
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

      {editDoc && (
        <DocumentEditDialog
          open
          doc={editDoc}
          mode="admin"
          onClose={() => setEditDoc(null)}
          onSaved={invalidateAll}
        />
      )}
    </Box>
  );
}
