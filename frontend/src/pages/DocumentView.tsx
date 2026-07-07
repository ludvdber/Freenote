import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { Typography, Box, Button, Chip, TextField, Snackbar, Alert, CircularProgress, Breadcrumbs, Link as MuiLink, IconButton, Tooltip, Menu, MenuItem, ListItemIcon, Collapse, useTheme } from '@mui/material';
import { Download, Favorite, FavoriteBorder, Flag, Share, SmartToy, Edit, DeleteOutlined, NavigateNext, MoreHoriz, Visibility, Star, Close, Style, Quiz as QuizIcon, ArrowForward } from '@mui/icons-material';
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
  renameDocument,
  searchDocuments,
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
  const { token, isVerified, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [reportReason, setReportReason] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [shareStatus, setShareStatus] = useState<'copied' | 'shared' | null>(null);
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
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
    setShowRename(false);
    setMenuAnchor(null);
    setOutline([]);
  }

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

  const isOwner = !!doc && doc.authorId != null && user?.id === doc.authorId;
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
  if (!doc) {
    return (
      <PageWrapper>
        <Typography>{t('common.error')}</Typography>
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
          {doc.courseName} · {doc.sectionName}
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

      {/* Hiérarchie d'actions : Télécharger est LA seule action primaire ; partage/favori/
          signaler en icônes (le drapeau vaut mieux qu'un item caché dans un menu) ; seules
          les actions du propriétaire (renommer, supprimer) restent dans le « ⋯ ». Signaler
          est masqué sur son propre doc (le backend le refuse déjà). */}
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
        {isOwner && (
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
                  setRenameValue(doc.title);
                  setShowRename(true);
                }}
              >
                <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
                {t('document.rename')}
              </MenuItem>
              <MenuItem
                disabled={deleteMutation.isPending}
                onClick={() => {
                  setMenuAnchor(null);
                  if (window.confirm(t('document.deleteConfirm'))) deleteMutation.mutate();
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
              <Typography variant="caption" sx={s.sideTitle}>
                {t('document.sameCourse')} — {doc.courseName}
              </Typography>
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

      <AdSlot width={728} height={90} sx={{ mt: 4 }} />
    </PageWrapper>
  );
}
