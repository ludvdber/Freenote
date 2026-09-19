import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { Typography, Box, Button, Chip, TextField, Snackbar, Alert, CircularProgress, Breadcrumbs, Link as MuiLink, IconButton, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText, Divider, Collapse, useTheme } from '@mui/material';
import { Download, Favorite, FavoriteBorder, Flag, Share, SmartToy, Edit, DeleteOutlined, NavigateNext, MoreHoriz, Visibility, Star, Close, Style, Quiz as QuizIcon, ArrowForward, Shield, CheckCircle, RemoveCircleOutlined, SearchOff } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getDocumentById,
  getAdjacentDocuments,
  rateDocument,
  toggleFavorite,
  reportDocument,
  getAverageRating,
  getMyRating,
  recordDocVisit,
  getFavoriteStatus,
  deleteDocument,
  searchDocuments,
  verifyDocument,
  adminUpdateDocument,
  adminDeleteDocument,
  listQuizzes,
  listSharedDecks,
} from '@/api/endpoints';
import axios from 'axios';
import { Helmet } from 'react-helmet-async';
import { useAuthStore } from '@/stores/useAuthStore';
import { categoryColor, formatRelativeDate, shareOrCopy } from '@/lib/utils';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';
import UploaderCard from '@/components/common/UploaderCard';
import StarRating from '@/components/ui/StarRating';
import Shimmer from '@/components/ui/Shimmer';
import AdSlot from '@/components/ui/AdSlot';
import DocumentEditDialog from '@/components/common/DocumentEditDialog';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { REPORT_TYPES } from '@/lib/reports';
import type { ReportType } from '@/types';
// import type = effacé à la compilation : ne charge PAS le chunk pdf.js, contrairement au lazy() dessous.
import type { PdfOutlineEntry, PdfViewerHandle } from '@/components/common/PdfViewer';
import * as s from './DocumentView.styles';

// Lazy so pdf.js (heavy) only loads once a document is actually open.
const PdfViewer = lazy(() => import('@/components/common/PdfViewer'));

export default function DocumentView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { token, isVerified, user, isAdmin } = useAuthStore();
  const queryClient = useQueryClient();
  const [reportReason, setReportReason] = useState('');
  const [reportType, setReportType] = useState<ReportType>('AUTRE');
  const [showReport, setShowReport] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [shareStatus, setShareStatus] = useState<'copied' | 'shared' | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  // Édition : le MÊME dialogue sert l'auteur et le staff, seul le mode change (le mode admin
  // ajoute l'interrupteur « Vérifié »).
  const [editMode, setEditMode] = useState<'owner' | 'admin' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<'own' | 'admin' | null>(null);
  // Nudge « note ce doc » affiché juste APRÈS un téléchargement (jamais à l'arrivée sur la page).
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const nudgeTimer = useRef<number | null>(null);
  // Sommaire extrait du PDF (outline pdf.js) + contrôleur de saut de page du viewer.
  const [outline, setOutline] = useState<PdfOutlineEntry[]>([]);
  const viewerCtl = useRef<PdfViewerHandle | null>(null);
  const viewerColRef = useRef<HTMLDivElement | null>(null);

  // Reset des états volatils quand on navigue de doc en doc (prev/next, du même cours) — le
  // composant reste monté. Pattern render-adjust (recommandé React), comme favStatus plus bas.
  const [prevId, setPrevId] = useState(id);
  if (id !== prevId) {
    setPrevId(id);
    setNudgeOpen(false);
    setShowReport(false);
    setReportReason('');
    setReportType('AUTRE');
    setMenuAnchor(null);
    setEditMode(null);
    setConfirmDelete(null);
    setOutline([]);
  }

  const { data: doc, isLoading, isError, error: docError } = useQuery({
    queryKey: ['document', id],
    queryFn: () => getDocumentById(Number(id)),
    enabled: !!id,
    // Un 404 est une réponse définitive (document supprimé) : réessayer trois fois ne fait
    // qu'allonger l'attente avant d'afficher l'explication.
    retry: (count, err) => !(axios.isAxiosError(err) && err.response?.status === 404) && count < 2,
  });

  const { data: avgRating } = useQuery({
    queryKey: ['rating', id],
    queryFn: () => getAverageRating(Number(id)),
    enabled: !!id,
  });

  // Ma note (0 = pas encore voté) — pilote l'affichage du rail : tant que je n'ai pas noté, la
  // grosse carte « Ce doc t'a aidé ? » ; après, une carte compacte « Ta note » (modifiable).
  const { data: myRating } = useQuery({
    queryKey: ['my-rating', id],
    queryFn: () => getMyRating(Number(id)),
    enabled: !!id && isVerified,
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

  // Voisins précédent/suivant du même cours (navigation sous le viewer).
  const { data: adjacent } = useQuery({
    queryKey: ['adjacent-docs', id],
    queryFn: () => getAdjacentDocuments(Number(id)),
    enabled: !!id && isVerified,
  });

  const courseId = doc?.courseId;

  // « Réviser ce cours » : quiz + paquets publiés rattachés au même cours.
  const { data: courseQuizzes } = useQuery({
    queryKey: ['course-quizzes', courseId],
    queryFn: () => listQuizzes({ courseId: courseId!, size: 10 }),
    enabled: !!courseId && isVerified,
  });
  const { data: courseDecks } = useQuery({
    queryKey: ['course-decks', courseId],
    queryFn: () => listSharedDecks({ courseId: courseId!, size: 10 }),
    enabled: !!courseId && isVerified,
  });

  // « Du même cours » : les plus consultés du cours, sans le doc courant.
  const { data: sameCoursePage } = useQuery({
    queryKey: ['same-course-docs', courseId],
    // Valeur whitelistée backend (comme SORT_API de Browse) — « popular » nu ferait un 400.
    queryFn: () => searchDocuments({ courseId: courseId!, sort: 'downloadCount:desc', size: 6 }),
    enabled: !!courseId && isVerified,
  });
  const sameDocs = useMemo(
    () => (sameCoursePage?.content ?? []).filter((d) => d.id !== Number(id)).slice(0, 4),
    [sameCoursePage, id],
  );

  const reviseItems = useMemo(() => [
    ...(courseDecks?.content ?? []).map((d) => ({
      kind: 'deck' as const,
      id: d.id,
      title: d.title,
      sub: `${t('document.reviseCards', { count: d.cardCount })}${d.ownerName ? ` · ${d.ownerName}` : ''}`,
      to: `/outils/flashcards#deck=${d.id}`,
    })),
    ...(courseQuizzes?.content ?? []).map((q) => ({
      kind: 'quiz' as const,
      id: q.id,
      title: q.title,
      sub: `${t('document.reviseQuestions', { count: q.questionCount })}${q.ownerName ? ` · ${q.ownerName}` : ''}`,
      to: `/outils/quiz#play=${q.id}`,
    })),
  ], [courseDecks, courseQuizzes, t]);

  // Sync the heart icon with the server's favorite status when it loads/changes. Adjusting
  // state during render (React's recommended pattern) instead of an effect avoids a cascading render.
  const [prevFavStatus, setPrevFavStatus] = useState(favStatus);
  if (favStatus !== prevFavStatus) {
    setPrevFavStatus(favStatus);
    if (favStatus) setIsFav(favStatus.isFavorite);
  }

  // Direct URL to the authenticated file endpoint (same-origin → HttpOnly JWT cookie sent
  // automatically). Used by the "Download" action; the inline preview goes through <PdfViewer>
  // (pdf.js canvas) which renders on mobile too, unlike the old <iframe> that Chrome Android blocks.
  const pdfSrc = isVerified && doc ? `/api/documents/${id}/file` : null;

  // Record visit so this doc surfaces in the user's "recent" trail on the home page
  useEffect(() => {
    if (!token || !doc?.id || !doc.verified) return;
    recordDocVisit(doc.id).catch(() => { /* best-effort, no UX impact */ });
    queryClient.invalidateQueries({ queryKey: ['recent-docs'] });
  }, [token, doc?.id, doc?.verified, queryClient]);

  useEffect(() => () => {
    if (nudgeTimer.current) window.clearTimeout(nudgeTimer.current);
  }, []);

  const [ratingFeedback, setRatingFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);

  const rateMutation = useMutation({
    mutationFn: (score: number) => rateDocument(Number(id), { score }),
    onSuccess: () => {
      // Refresh the new average everywhere the doc's rating shows: the viewer itself, the
      // explorer list cards and the home "popular" rail — otherwise they stay stale until a reload.
      queryClient.invalidateQueries({ queryKey: ['rating', id] });
      queryClient.invalidateQueries({ queryKey: ['my-rating', id] });
      queryClient.invalidateQueries({ queryKey: ['document', id] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
      queryClient.invalidateQueries({ queryKey: ['popular-docs'] });
      setNudgeOpen(false);
      setRatingFeedback({ severity: 'success', message: t('document.ratingSaved') });
    },
    onError: (err) => {
      // Avant : échec 100 % silencieux — l'étoile semblait prise mais rien n'était persisté.
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message
        : undefined;
      setRatingFeedback({ severity: 'error', message: msg || t('common.error') });
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

  const afterRemoval = () => {
    queryClient.invalidateQueries({ queryKey: ['search'] });
    queryClient.invalidateQueries({ queryKey: ['popular-docs'] });
    queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    queryClient.invalidateQueries({ queryKey: ['admin-all-docs'] });
    queryClient.invalidateQueries({ queryKey: ['admin-pending-docs'] });
    if (user?.id) queryClient.invalidateQueries({ queryKey: ['user-docs', user.id] });
    navigate('/browse');
  };

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(Number(id)),
    onSuccess: afterRemoval,
  });

  // Suppression par le staff sur un document qui n'est pas le sien : passe par la route admin
  // (DELETE /api/documents/{id} l'autorise aussi pour un ADMIN, mais pas pour un MODÉRATEUR).
  const adminDeleteMutation = useMutation({
    mutationFn: () => adminDeleteDocument(Number(id)),
    onSuccess: afterRemoval,
  });

  const invalidateDoc = () => {
    queryClient.invalidateQueries({ queryKey: ['document', id] });
    queryClient.invalidateQueries({ queryKey: ['search'] });
    queryClient.invalidateQueries({ queryKey: ['popular-docs'] });
    queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
  };

  // Vérifier / dé-vérifier sans quitter la page — l'action de modération la plus courante.
  const verifyMutation = useMutation({
    mutationFn: () => verifyDocument(Number(id)),
    onSuccess: () => {
      invalidateDoc();
      setRatingFeedback({ severity: 'success', message: t('document.staffVerified') });
    },
  });
  const unverifyMutation = useMutation({
    mutationFn: () => adminUpdateDocument(Number(id), { verified: false }),
    onSuccess: () => {
      invalidateDoc();
      setRatingFeedback({ severity: 'success', message: t('document.staffUnverified') });
    },
  });

  const reportMutation = useMutation({
    mutationFn: () => reportDocument(Number(id), { type: reportType, reason: reportReason.trim() }),
    onSuccess: () => {
      setShowReport(false);
      setReportReason('');
      setReportType('AUTRE');
      // Avant : aucun retour — impossible de savoir si le signalement était parti.
      setRatingFeedback({ severity: 'success', message: t('document.reportThanks') });
    },
    onError: (err) => {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message
        : undefined;
      setRatingFeedback({ severity: 'error', message: msg || t('common.error') });
    },
  });

  // `owned` vient du serveur : c'est le SEUL signal fiable sur un document anonyme, dont
  // `authorId` est volontairement nul — la comparaison « authorId === user.id » retirait donc à
  // l'auteur d'un dépôt anonyme toute action sur son propre document. Le repli couvre les données
  // encore en cache d'avant ce changement.
  const isOwner = !!doc && (doc.owned || (doc.authorId != null && user?.id === doc.authorId));
  const canModerate = !!token && (isAdmin || !!user?.moderator);
  // Un membre du staff sur le document d'un autre : ses actions passent par les routes admin.
  const staffOnOther = canModerate && !isOwner;
  const hasRated = (myRating ?? 0) > 0;

  const handleDownload = () => {
    if (!pdfSrc) return;
    const a = document.createElement('a');
    a.href = pdfSrc;
    a.download = `${doc?.title ?? 'document'}.pdf`;
    a.click();
    // Nudge de notation différé d'une seconde — le temps que le téléchargement démarre.
    if (isVerified && !isOwner && !hasRated) {
      if (nudgeTimer.current) window.clearTimeout(nudgeTimer.current);
      nudgeTimer.current = window.setTimeout(() => setNudgeOpen(true), 1000);
    }
  };

  const jumpToPage = (page: number) => {
    viewerCtl.current?.scrollToPage(page);
    // Sur mobile le sommaire vit SOUS le viewer — on ramène le viewer à l'écran (no-op si visible).
    viewerColRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  if (isLoading) {
    return (
      <PageWrapper>
        <Shimmer count={3} height={200} />
      </PageWrapper>
    );
  }
  // Un lien vers un document supprimé n'affichait qu'un « Une erreur est survenue » nu : le
  // visiteur ne pouvait pas savoir si le document avait disparu, s'il n'y avait plus accès, ou si
  // le site était cassé. Le cas est légitime (le document N'EXISTE plus) — il mérite une réponse.
  if (!doc) {
    const gone = isError && axios.isAxiosError(docError) && docError.response?.status === 404;
    return (
      <PageWrapper maxWidth="sm">
        <Helmet><title>{`${t(gone ? 'document.goneTitle' : 'common.error')} · Freenote`}</title></Helmet>
        <GlassCard sx={{ p: 4, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'center' }}>
          <SearchOff sx={{ fontSize: 48, opacity: 0.5 }} aria-hidden="true" />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {t(gone ? 'document.goneTitle' : 'common.error')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(gone ? 'document.goneText' : 'document.loadError')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button variant="contained" component={RouterLink} to="/browse">{t('nav.browse')}</Button>
            <Button color="inherit" onClick={() => navigate(-1)}>{t('common.back')}</Button>
          </Box>
        </GlassCard>
      </PageWrapper>
    );
  }

  const average = avgRating ?? doc.averageRating ?? 0;
  const prevDoc = adjacent?.previous ?? null;
  const nextDoc = adjacent?.next ?? null;

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
            sx={s.categoryChip(categoryColor(doc.category, theme.palette.mode))}
          />
          {/* Cohérence carte v3 : vérifié = état par défaut, pas de badge — seuls « En attente »
              et « IA » signalent une particularité. */}
          {!doc.verified && (
            <Chip size="small" variant="outlined" color="warning" label={t('document.pending')} />
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
          {/* Le nom du cours mène à sa page (accès direct au hub du cours, en plus du fil d'Ariane). */}
          {doc.courseId ? (
            <MuiLink component={RouterLink} to={`/courses/${doc.courseId}`} underline="hover" color="inherit" sx={{ fontWeight: 600 }}>
              {doc.courseName}
            </MuiLink>
          ) : doc.courseName}
          {' · '}{doc.sectionName}
          {!doc.authorId && ` · ${doc.authorName}`}
        </Typography>
        {/* Méta compacte (remplace l'ancienne carte 5 colonnes) : année · note · vues · date ·
            prof · langue. La moyenne vit ici pour rester visible même sans carte de notation
            (auteur du doc, visiteur non vérifié). */}
        <Box sx={s.metaLine}>
          {doc.year && (
            <Typography component="span" variant="caption" className="mono">{doc.year}</Typography>
          )}
          {doc.ratingCount > 0 && (
            <Typography component="span" variant="caption" className="mono" sx={s.metaItem}>
              <Star sx={{ fontSize: 14, color: '#ffd93d' }} aria-hidden="true" />
              {average.toFixed(1)} · {t('document.votes', { count: doc.ratingCount })}
            </Typography>
          )}
          <Typography component="span" variant="caption" className="mono" sx={s.metaItem}>
            <Visibility sx={{ fontSize: 14 }} aria-hidden="true" />
            {doc.downloadCount} {t('document.downloads').toLowerCase()}
          </Typography>
          <Typography component="span" variant="caption">
            {formatRelativeDate(doc.createdAt, i18n.language)}
          </Typography>
          {doc.professorName && (
            <Typography component="span" variant="caption">{doc.professorName}</Typography>
          )}
          <Typography component="span" variant="caption">{doc.language}</Typography>
        </Box>
      </Box>

      {/* Hiérarchie d'actions : Télécharger est LA seule action primaire ; partage / favori /
          signaler / modifier en icônes ; le « ⋯ » ne garde que le rare et l'irréversible
          (vérifier, dé-vérifier, supprimer). Signaler est masqué sur son propre document —
          le backend le refuse désormais aussi, on corrige son dépôt, on ne le signale pas. */}
      <Box sx={s.actionsRow}>
        {isVerified && pdfSrc && (
          <Button variant="contained" startIcon={<Download />} onClick={handleDownload}>
            {t('document.download')}
          </Button>
        )}
        <Tooltip title={t('common.share')}>
          <IconButton
            aria-label={t('common.share')}
            onClick={async () => {
              const result = await shareOrCopy({
                title: doc?.title,
                text: doc?.title,
                url: window.location.href,
              });
              if (result !== 'error') setShareStatus(result);
            }}
          >
            <Share />
          </IconButton>
        </Tooltip>
        {token && (
          <Tooltip title={isFav ? t('document.removeFavorite') : t('document.addFavorite')}>
            <IconButton
              aria-label={isFav ? t('document.removeFavorite') : t('document.addFavorite')}
              color={isFav ? 'error' : 'default'}
              onClick={() => favMutation.mutate()}
            >
              {isFav ? <Favorite /> : <FavoriteBorder />}
            </IconButton>
          </Tooltip>
        )}
        {isVerified && !isOwner && (
          <Tooltip title={t('document.report')}>
            <IconButton
              aria-label={t('document.report')}
              color={showReport ? 'error' : 'default'}
              onClick={() => setShowReport((v) => !v)}
            >
              <Flag />
            </IconButton>
          </Tooltip>
        )}
        {/* Édition SORTIE du menu : « je corrige mon dépôt » est l'action la plus fréquente après
            le téléchargement, elle ne mérite pas d'être cachée derrière un « ⋯ ». */}
        {(isOwner || staffOnOther) && (
          <Tooltip title={t('document.editTitle')}>
            <IconButton
              aria-label={t('document.editTitle')}
              onClick={() => setEditMode(isOwner ? 'owner' : 'admin')}
            >
              <Edit />
            </IconButton>
          </Tooltip>
        )}

        {/* Marqueur explicite quand on agit AVEC ses droits de staff sur le document d'autrui :
            sans lui, rien ne distingue une action d'auteur d'une action de modération. */}
        {staffOnOther && (
          <Chip
            size="small"
            icon={<Shield sx={{ fontSize: 14 }} />}
            label={t('document.staffMode')}
            color="warning"
            variant="outlined"
            sx={{ ml: 0.5 }}
          />
        )}

        {(isOwner || staffOnOther) && (
          <>
            <Tooltip title={t('document.moreActions')}>
              <IconButton
                aria-label={t('document.moreActions')}
                aria-haspopup="menu"
                onClick={(e) => setMenuAnchor(e.currentTarget)}
              >
                <MoreHoriz />
              </IconButton>
            </Tooltip>
            <Menu anchorEl={menuAnchor} open={menuAnchor !== null} onClose={() => setMenuAnchor(null)}>
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null);
                  setEditMode(isOwner ? 'owner' : 'admin');
                }}
              >
                <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
                <ListItemText
                  primary={t('document.editTitle')}
                  secondary={t('document.editFields')}
                  slotProps={{ secondary: { variant: 'caption' } }}
                />
              </MenuItem>

              {staffOnOther && <Divider />}
              {staffOnOther && !doc.verified && (
                <MenuItem
                  disabled={verifyMutation.isPending}
                  onClick={() => { setMenuAnchor(null); verifyMutation.mutate(); }}
                >
                  <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
                  {t('admin.docs.verify')}
                </MenuItem>
              )}
              {staffOnOther && doc.verified && (
                <MenuItem
                  disabled={unverifyMutation.isPending}
                  onClick={() => { setMenuAnchor(null); unverifyMutation.mutate(); }}
                >
                  <ListItemIcon><RemoveCircleOutlined fontSize="small" /></ListItemIcon>
                  <ListItemText
                    primary={t('document.unverify')}
                    secondary={t('document.unverifyHint')}
                    slotProps={{ secondary: { variant: 'caption' } }}
                  />
                </MenuItem>
              )}

              <Divider />
              <MenuItem
                disabled={deleteMutation.isPending || adminDeleteMutation.isPending}
                onClick={() => {
                  setMenuAnchor(null);
                  setConfirmDelete(isOwner ? 'own' : 'admin');
                }}
                sx={{ color: 'error.main' }}
              >
                <ListItemIcon><DeleteOutlined fontSize="small" color="error" /></ListItemIcon>
                {t('document.delete')}
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>

      {/* Signaler = dire CE QUI ne va pas, pas juste « il y a un souci ». Le type choisi ici est
          ce qui rend la file de modération triable par problème ; le message reste obligatoire
          (un type seul n'est jamais actionnable). */}
      <Collapse in={showReport} unmountOnExit>
        <GlassCard sx={{ p: 2, mb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{t('document.reportTitle')}</Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {REPORT_TYPES.map((rt) => (
              <Chip
                key={rt.id}
                size="small"
                label={`${rt.emoji} ${t(`reportTypes.${rt.id}.label`)}`}
                color={reportType === rt.id ? rt.color : 'default'}
                variant={reportType === rt.id ? 'filled' : 'outlined'}
                onClick={() => setReportType(rt.id)}
              />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t(`reportTypes.${reportType}.hint`)}
          </Typography>
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={2}
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value.slice(0, 1000))}
            placeholder={t('document.reportPlaceholder')}
            helperText={t('document.reportReasonHelp')}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button color="inherit" onClick={() => setShowReport(false)}>{t('common.cancel')}</Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => reportMutation.mutate()}
              disabled={!reportReason.trim() || reportMutation.isPending}
            >
              {t('document.report')}
            </Button>
          </Box>
        </GlassCard>
      </Collapse>

      {/* Nudge post-téléchargement : demander la note juste après la consommation de la valeur
          (timing Udemy/Booking) — jamais à l'arrivée sur la page. */}
      <Collapse in={nudgeOpen}>
        <Box sx={s.nudge}>
          <Box sx={s.nudgeText}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{t('document.nudgeTitle')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('document.nudgeText')}</Typography>
          </Box>
          <StarRating value={0} onChange={(v) => rateMutation.mutate(v)} size={30} />
          <Chip size="small" label={t('document.xpChipShort')} sx={s.xpChip} />
          <IconButton size="small" onClick={() => setNudgeOpen(false)} aria-label={t('common.close')}>
            <Close fontSize="small" />
          </IconButton>
        </Box>
      </Collapse>

      {!isVerified && token && (
        <GlassCard sx={{ p: 3, mb: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {t('auth.verifyEmailMessage')}
          </Typography>
        </GlassCard>
      )}

      <Box sx={s.cols}>
        {/* ——— Colonne principale : viewer + navigation précédent/suivant ——— */}
        <Box ref={viewerColRef} sx={{ minWidth: 0 }}>
          {isVerified && (
            <Suspense fallback={<Box sx={s.pdfViewerWrapper}><Box sx={s.pdfLoading}><CircularProgress /></Box></Box>}>
              <PdfViewer docId={Number(id)} title={doc.title} onOutline={setOutline} controllerRef={viewerCtl} />
            </Suspense>
          )}

          {(prevDoc || nextDoc) && (
            <Box sx={s.pnGrid}>
              {prevDoc ? (
                <GlassCard component={RouterLink} to={`/documents/${prevDoc.id}`} sx={s.pnCard(false)}>
                  <Typography component="span" sx={s.pnLabel}>← {t('document.prevDoc')} · {doc.courseName}</Typography>
                  <Typography component="span" sx={s.pnTitle}>{prevDoc.title}</Typography>
                </GlassCard>
              ) : (
                <span aria-hidden="true" />
              )}
              {nextDoc && (
                <GlassCard component={RouterLink} to={`/documents/${nextDoc.id}`} sx={s.pnCard(true)}>
                  <Typography component="span" sx={s.pnLabel}>{t('document.nextDoc')} · {doc.courseName} →</Typography>
                  <Typography component="span" sx={s.pnTitle}>{nextDoc.title}</Typography>
                </GlassCard>
              )}
            </Box>
          )}
        </Box>

        {/* ——— Rail droit : notation, réviser, sommaire, uploader, du même cours ——— */}
        <Box sx={s.rail}>
          {isVerified && !isOwner && (
            hasRated ? (
              // Déjà noté : la grosse carte disparaît (demande explicite 2026-07-07) — reste une
              // carte compacte « Ta note », toujours modifiable.
              <GlassCard sx={s.sideCard}>
                <Typography variant="caption" sx={s.sideTitle}>{t('document.myRating')}</Typography>
                <StarRating value={myRating ?? 0} onChange={(v) => rateMutation.mutate(v)} />
                {doc.ratingCount > 0 && (
                  <Typography variant="caption" color="text.secondary" className="mono" sx={{ display: 'block', mt: 1 }}>
                    {average.toFixed(1)} · {t('document.votes', { count: doc.ratingCount })}
                  </Typography>
                )}
              </GlassCard>
            ) : (
              <Box sx={s.rateCard}>
                <Typography variant="h6" sx={s.rateTitle}>
                  {doc.ratingCount === 0 ? t('document.rateFirstTitle') : t('document.rateCardTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={s.rateWhy}>
                  {t('document.rateCardWhy')}
                </Typography>
                <StarRating value={0} onChange={(v) => rateMutation.mutate(v)} size={34} />
                <Box sx={s.rateMeta}>
                  {doc.ratingCount > 0 ? (
                    <Typography variant="caption" color="text.secondary" className="mono">
                      {average.toFixed(1)} · {t('document.votes', { count: doc.ratingCount })}
                    </Typography>
                  ) : (
                    <span />
                  )}
                  <Chip size="small" label={t('document.rateXpChip')} sx={s.xpChip} />
                </Box>
                {doc.ratingCount === 0 && (
                  <Typography variant="caption" sx={s.zeroState}>{t('document.rateFirstHint')}</Typography>
                )}
              </Box>
            )
          )}

          {reviseItems.length > 0 && (
            <GlassCard sx={s.sideCard}>
              <Typography variant="caption" sx={s.sideTitle}>{t('document.reviseTitle')}</Typography>
              <Box sx={s.reviseList(reviseItems.length >= 3)}>
                {reviseItems.map((item) => (
                  <Box key={`${item.kind}-${item.id}`} component={RouterLink} to={item.to} sx={s.reviseRow}>
                    {item.kind === 'deck'
                      ? <Style sx={{ color: 'secondary.main' }} aria-hidden="true" />
                      : <QuizIcon sx={{ color: 'primary.main' }} aria-hidden="true" />}
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" sx={s.reviseTitle}>{item.title}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.sub}</Typography>
                    </Box>
                    <ArrowForward sx={{ fontSize: 16, color: 'primary.main' }} aria-hidden="true" />
                  </Box>
                ))}
              </Box>
            </GlassCard>
          )}

          {/* Sommaire : masqué à 0 ou 1 entrée (inutile), scrollable au-delà de 10. */}
          {outline.length > 1 && (
            <GlassCard sx={s.sideCard}>
              <Typography variant="caption" sx={s.sideTitle}>{t('document.tocTitle')}</Typography>
              <Box sx={s.tocList(outline.length > 10)}>
                {outline.map((entry, i) => (
                  <Box
                    key={`${entry.page}-${i}`}
                    component="button"
                    type="button"
                    onClick={() => jumpToPage(entry.page)}
                    sx={s.tocRow(entry.level > 0)}
                  >
                    <Box component="span" sx={s.tocEntry}>{entry.title}</Box>
                    <Typography component="span" variant="caption" className="mono" sx={{ flexShrink: 0 }}>
                      {t('document.tocPage', { page: entry.page })}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </GlassCard>
          )}

          {doc.authorId && <UploaderCard authorId={doc.authorId} sx={{ mb: 0 }} />}

          {sameDocs.length > 0 && (
            <GlassCard sx={s.sideCard}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="caption" sx={s.sideTitle}>
                  {t('document.sameCourse')} — {doc.courseName}
                </Typography>
                {doc.courseId && (
                  <MuiLink
                    component={RouterLink}
                    to={`/courses/${doc.courseId}`}
                    underline="hover"
                    sx={{ fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {t('document.viewCourseAll')} →
                  </MuiLink>
                )}
              </Box>
              {sameDocs.map((d) => (
                <Box key={d.id} component={RouterLink} to={`/documents/${d.id}`} sx={s.sameRow}>
                  <Typography component="span" className="same-title" sx={s.sameTitle}>{d.title}</Typography>
                  <Typography component="span" className="mono" sx={s.sameViews}>
                    <Visibility sx={{ fontSize: 12 }} aria-hidden="true" /> {d.downloadCount}
                  </Typography>
                </Box>
              ))}
            </GlassCard>
          )}
        </Box>
      </Box>

      <Snackbar open={shareStatus !== null} autoHideDuration={2000} onClose={() => setShareStatus(null)}>
        <Alert severity="success" onClose={() => setShareStatus(null)}>
          {shareStatus === 'shared' ? t('common.shared') : t('common.linkCopied')}
        </Alert>
      </Snackbar>

      <Snackbar open={ratingFeedback !== null} autoHideDuration={3000} onClose={() => setRatingFeedback(null)}>
        <Alert severity={ratingFeedback?.severity ?? 'success'} onClose={() => setRatingFeedback(null)}>
          {ratingFeedback?.message}
        </Alert>
      </Snackbar>

      {/* Même fiche d'édition que dans le panel admin — seul le mode diffère (le mode « admin »
          ajoute l'interrupteur Vérifié). */}
      {editMode && (
        <DocumentEditDialog
          open
          doc={doc}
          mode={editMode}
          onClose={() => setEditMode(null)}
          onSaved={() => setRatingFeedback({ severity: 'success', message: t('document.editSaved') })}
        />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t('document.delete')}
        message={confirmDelete === 'admin' ? t('document.deleteStaffConfirm') : t('document.deleteConfirm')}
        confirmLabel={t('document.delete')}
        loading={deleteMutation.isPending || adminDeleteMutation.isPending}
        onConfirm={() => {
          if (confirmDelete === 'admin') adminDeleteMutation.mutate();
          else deleteMutation.mutate();
          setConfirmDelete(null);
        }}
        onClose={() => setConfirmDelete(null)}
      />

      <AdSlot width={728} height={90} sx={{ mt: 4 }} />
    </PageWrapper>
  );
}
