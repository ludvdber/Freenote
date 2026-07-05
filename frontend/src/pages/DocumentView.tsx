import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { Typography, Box, Button, Chip, TextField, Grid, Snackbar, Alert, CircularProgress, Breadcrumbs, Link as MuiLink } from '@mui/material';
import { Download, Favorite, FavoriteBorder, Flag, Share, Verified, SmartToy, Edit, DeleteOutlined, NavigateNext } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getDocumentById,
  rateDocument,
  toggleFavorite,
  reportDocument,
  getAverageRating,
  recordDocVisit,
  getFavoriteStatus,
  deleteDocument,
  renameDocument,
} from '@/api/endpoints';
import { Helmet } from 'react-helmet-async';
import { useAuthStore } from '@/stores/useAuthStore';
import { categoryColor, formatDate, shareOrCopy } from '@/lib/utils';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';
import UploaderCard from '@/components/common/UploaderCard';
import StarRating from '@/components/ui/StarRating';
import Shimmer from '@/components/ui/Shimmer';
import AdSlot from '@/components/ui/AdSlot';
import * as s from './DocumentView.styles';

// Lazy so pdf.js (heavy) only loads once a document is actually open.
const PdfViewer = lazy(() => import('@/components/common/PdfViewer'));

export default function DocumentView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { token, isVerified, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [reportReason, setReportReason] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [shareStatus, setShareStatus] = useState<'copied' | 'shared' | null>(null);
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const { data: doc, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: () => getDocumentById(Number(id)),
    enabled: !!id,
  });

  const { data: avgRating } = useQuery({
    queryKey: ['rating', id],
    queryFn: () => getAverageRating(Number(id)),
    enabled: !!id,
  });

  // Hydrate the heart icon at load — without this, the button always says "Add to favorites"
  // even when the doc is already in the user's favorites.
  const { data: favStatus } = useQuery({
    queryKey: ['favorite-status', id],
    queryFn: () => getFavoriteStatus(Number(id)),
    enabled: !!id && !!token,
    // Always reflect the server's truth when opening the doc — otherwise favoriting elsewhere
    // (a card, another view) leaves a stale "add to favorites" here until a manual refresh.
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Sync the heart icon with the server's favorite status when it loads/changes. Adjusting
  // state during render (React's recommended pattern) instead of an effect avoids a cascading render.
  const [prevFavStatus, setPrevFavStatus] = useState(favStatus);
  if (favStatus !== prevFavStatus) {
    setPrevFavStatus(favStatus);
    if (favStatus) setIsFav(favStatus.isFavorite);
  }

  // Direct URL to the authenticated file endpoint (same-origin → HttpOnly JWT cookie sent
  // automatically). Used by the "Download" action; the inline preview now goes through <PdfViewer>
  // (pdf.js canvas) which renders on mobile too, unlike the old <iframe> that Chrome Android blocks.
  const pdfSrc = isVerified && doc ? `/api/documents/${id}/file` : null;

  // Record visit so this doc surfaces in the user's "recent" trail on the home page
  useEffect(() => {
    if (!token || !doc?.id || !doc.verified) return;
    recordDocVisit(doc.id).catch(() => { /* best-effort, no UX impact */ });
    queryClient.invalidateQueries({ queryKey: ['recent-docs'] });
  }, [token, doc?.id, doc?.verified, queryClient]);

  const rateMutation = useMutation({
    mutationFn: (score: number) => rateDocument(Number(id), { score }),
    onSuccess: () => {
      // Refresh the new average everywhere the doc's rating shows: the viewer itself, the
      // explorer list cards and the home "popular" rail — otherwise they stay stale until a reload.
      queryClient.invalidateQueries({ queryKey: ['rating', id] });
      queryClient.invalidateQueries({ queryKey: ['document', id] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
      queryClient.invalidateQueries({ queryKey: ['popular-docs'] });
    },
  });

  const favMutation = useMutation({
    mutationFn: () => toggleFavorite(Number(id)),
    onSuccess: (data) => {
      setIsFav(data.isFavorite);
      queryClient.setQueryData(['favorite-status', id], data);
      queryClient.invalidateQueries({ queryKey: ['my-favorites'] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: () => renameDocument(Number(id), renameValue.trim()),
    onSuccess: () => {
      setShowRename(false);
      queryClient.invalidateQueries({ queryKey: ['document', id] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
      queryClient.invalidateQueries({ queryKey: ['popular-docs'] });
      if (user?.id) queryClient.invalidateQueries({ queryKey: ['user-docs', user.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search'] });
      queryClient.invalidateQueries({ queryKey: ['popular-docs'] });
      if (user?.id) queryClient.invalidateQueries({ queryKey: ['user-docs', user.id] });
      navigate('/browse');
    },
  });

  const reportMutation = useMutation({
    mutationFn: () => reportDocument(Number(id), { reason: reportReason }),
    onSuccess: () => {
      setShowReport(false);
      setReportReason('');
    },
  });

  const handleDownload = () => {
    if (!pdfSrc) return;
    const a = document.createElement('a');
    a.href = pdfSrc;
    a.download = `${doc?.title ?? 'document'}.pdf`;
    a.click();
  };

  if (isLoading) {
    return (
      <PageWrapper>
        <Shimmer count={3} height={200} />
      </PageWrapper>
    );
  }
  if (!doc) {
    return (
      <PageWrapper>
        <Typography>{t('common.error')}</Typography>
      </PageWrapper>
    );
  }

  const isOwner = doc.authorId != null && user?.id === doc.authorId;

  return (
    <PageWrapper maxWidth="lg">
      <Helmet><title>{doc ? `${doc.title} · Freenote` : 'Freenote'}</title></Helmet>

      {/* Fil d'Ariane : Explorer → Cours → document courant. */}
      <Breadcrumbs separator={<NavigateNext fontSize="small" />} sx={{ mb: 2, fontSize: '0.85rem' }}>
        <MuiLink component={RouterLink} to="/browse" underline="hover" color="text.secondary">
          {t('nav.browse')}
        </MuiLink>
        {doc.courseId && (
          <MuiLink component={RouterLink} to={`/courses/${doc.courseId}`} underline="hover" color="text.secondary">
            {doc.courseName}
          </MuiLink>
        )}
        <Typography color="text.primary" sx={{ fontSize: 'inherit', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.title}
        </Typography>
      </Breadcrumbs>

      <Box sx={s.header}>
        <Box sx={s.chipsRow}>
          <Chip
            size="small"
            label={t(`categories.${doc.category}`)}
            sx={s.categoryChip(categoryColor(doc.category))}
          />
          {doc.verified && (
            <Chip
              size="small"
              variant="outlined"
              color="primary"
              icon={<Verified sx={{ fontSize: 14 }} />}
              label={t('document.verified')}
            />
          )}
          {doc.aiGenerated && (
            <Chip
              size="small"
              variant="outlined"
              color="warning"
              icon={<SmartToy sx={{ fontSize: 14 }} />}
              label={t('document.aiGenerated')}
            />
          )}
        </Box>

        <Typography variant="h3" sx={s.title}>
          {doc.title}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={s.subtitle}>
          {doc.courseName} · {doc.sectionName}
          {!doc.authorId && ` · ${doc.authorName}`}
        </Typography>
      </Box>

      {/* PDF Viewer — pdf.js canvas (renders inline on mobile, unlike an <iframe>) */}
      {isVerified && (
        <Suspense fallback={<Box sx={s.pdfViewerWrapper}><Box sx={s.pdfLoading}><CircularProgress /></Box></Box>}>
          <PdfViewer docId={Number(id)} title={doc.title} />
        </Suspense>
      )}

      {!isVerified && token && (
        <GlassCard sx={{ p: 3, mb: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {t('auth.verifyEmailMessage')}
          </Typography>
        </GlassCard>
      )}

      <GlassCard sx={s.metaCard}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <Typography variant="caption" color="text.secondary">
              {t('document.language')}
            </Typography>
            <Typography variant="body2">{doc.language}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <Typography variant="caption" color="text.secondary">
              {t('document.year')}
            </Typography>
            <Typography variant="body2">{doc.year ?? '—'}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <Typography variant="caption" color="text.secondary">
              {t('document.professor')}
            </Typography>
            <Typography variant="body2">{doc.professorName ?? '—'}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <Typography variant="caption" color="text.secondary">
              {t('document.downloads')}
            </Typography>
            <Typography variant="body2" className="mono">
              {doc.downloadCount}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <Typography variant="caption" color="text.secondary">
              {t('document.publishedAt')}
            </Typography>
            <Typography variant="body2" className="mono">
              {formatDate(doc.createdAt, i18n.language)}
            </Typography>
          </Grid>
        </Grid>
      </GlassCard>

      {doc.authorId && <UploaderCard authorId={doc.authorId} />}

      <Box sx={s.ratingRow}>
        <Box sx={s.ratingInner}>
          <Typography variant="body2" color="text.secondary">
            {t('document.rating')}:
          </Typography>
          <StarRating
            value={avgRating ?? doc.averageRating}
            readOnly={!isVerified || isOwner}
            onChange={(v) => rateMutation.mutate(v)}
          />
        </Box>
      </Box>

      <Box sx={s.actionsRow}>
        {isVerified && pdfSrc && (
          <Button variant="contained" startIcon={<Download />} onClick={handleDownload}>
            {t('document.download')}
          </Button>
        )}
        <Button
          variant="outlined"
          startIcon={<Share />}
          onClick={async () => {
            const result = await shareOrCopy({
              title: doc?.title,
              text: doc?.title,
              url: window.location.href,
            });
            if (result !== 'error') setShareStatus(result);
          }}
        >
          {t('common.share')}
        </Button>
        {token && (
          <Button
            variant="outlined"
            color={isFav ? 'error' : 'primary'}
            startIcon={isFav ? <Favorite /> : <FavoriteBorder />}
            onClick={() => favMutation.mutate()}
          >
            {isFav ? t('document.removeFavorite') : t('document.addFavorite')}
          </Button>
        )}
        {isVerified && (
          <Button variant="outlined" color="error" startIcon={<Flag />} onClick={() => setShowReport(!showReport)}>
            {t('document.report')}
          </Button>
        )}
        {isOwner && (
          <>
            <Button
              variant="outlined"
              startIcon={<Edit />}
              onClick={() => {
                setRenameValue(doc.title);
                setShowRename((v) => !v);
              }}
            >
              {t('document.rename')}
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlined />}
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm(t('document.deleteConfirm'))) deleteMutation.mutate();
              }}
            >
              {t('document.delete')}
            </Button>
          </>
        )}
      </Box>

      <Snackbar open={shareStatus !== null} autoHideDuration={2000} onClose={() => setShareStatus(null)}>
        <Alert severity="success" onClose={() => setShareStatus(null)}>
          {shareStatus === 'shared' ? t('common.shared') : t('common.linkCopied')}
        </Alert>
      </Snackbar>

      {showReport && (
        <Box sx={s.reportRow}>
          <TextField
            size="small"
            fullWidth
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder={t('document.reportPlaceholder')}
          />
          <Button
            variant="contained"
            color="error"
            onClick={() => reportMutation.mutate()}
            disabled={!reportReason}
          >
            {t('common.confirm')}
          </Button>
        </Box>
      )}

      {showRename && isOwner && (
        <Box sx={s.reportRow}>
          <TextField
            size="small"
            fullWidth
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value.slice(0, 50))}
            placeholder={t('document.renamePlaceholder')}
            helperText={`${renameValue.length}/50`}
            slotProps={{ htmlInput: { maxLength: 50 } }}
          />
          <Button
            variant="contained"
            onClick={() => renameMutation.mutate()}
            disabled={!renameValue.trim() || renameMutation.isPending}
          >
            {t('common.save')}
          </Button>
        </Box>
      )}

      <AdSlot width={728} height={90} sx={{ mt: 4 }} />
    </PageWrapper>
  );
}
