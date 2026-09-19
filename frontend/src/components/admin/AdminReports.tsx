import { useState, lazy, Suspense } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  Pagination,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
} from '@mui/material';
import {
  Gavel,
  Cancel,
  PictureAsPdf,
  OpenInNew,
  Edit,
  CheckCircleOutlined,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  getReports,
  getReportCounts,
  getDocumentById,
  resolveReport,
  dismissReport,
} from '@/api/endpoints';
import { formatDate, formatRelativeDate } from '@/lib/utils';
import { REPORT_TYPES, RESOLUTIONS, reportTypeMeta, suggestedResolution } from '@/lib/reports';
import GlassCard from '@/components/ui/GlassCard';
import DocumentEditDialog from '@/components/common/DocumentEditDialog';
import type { ReportResolution, ReportResponse, ReportType } from '@/types';

// Aperçu inline — même viewer que la file de modération des documents (lazy : pdf.js est lourd).
const PdfViewer = lazy(() => import('@/components/common/PdfViewer'));

const PAGE_SIZE = 15;
type StatusFilter = 'PENDING' | 'RESOLVED' | 'DISMISSED' | 'ALL';

/**
 * File de modération des signalements.
 *
 * <p>Refonte 2026-09-08. L'ancienne version (82 lignes) posait trois problèmes de fond :
 * on ne voyait pas le document signalé (pas d'aperçu, et le lien faisait perdre sa place),
 * les motifs n'étaient pas triables (texte libre uniquement), et surtout les deux boutons
 * « Résoudre » / « Rejeter » appelaient deux méthodes serveur RIGOUREUSEMENT identiques :
 * la ligne quittait la file en laissant croire qu'on avait agi, sans jamais toucher au document
 * ni prévenir qui que ce soit.
 *
 * <p>Ici : filtres par statut et par type (avec compteurs), aperçu PDF sur place, édition du
 * document sans changer d'écran, et un dialogue « Traiter » où l'on déclare ce qu'on fait —
 * décision que le serveur exécute réellement puis notifie au signaleur.
 */
export default function AdminReports() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<StatusFilter>('PENDING');
  const [type, setType] = useState<ReportType | null>(null);
  const [page, setPage] = useState(0);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [editDocId, setEditDocId] = useState<number | null>(null);
  const [decideOn, setDecideOn] = useState<ReportResponse | null>(null);

  // Changer de filtre remet en page 1 — sinon on atterrit sur une page qui n'existe plus une fois
  // le résultat rétréci. Ajustement pendant le rendu (pattern React), pas d'effet en cascade.
  const filterKey = `${status}:${type ?? ''}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(0);
    setPreviewId(null);
  }

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reports', status, type, page],
    queryFn: () => getReports({
      status: status === 'ALL' ? undefined : status,
      type: type ?? undefined,
      page,
      size: PAGE_SIZE,
    }),
  });

  const { data: counts } = useQuery({
    queryKey: ['admin-report-counts'],
    queryFn: getReportCounts,
  });

  // Le document à éditer n'est pas porté par le signalement (qui n'a que son résumé) : on le
  // charge à l'ouverture du dialogue. La fiche d'édition est la MÊME que sur la page du document.
  const { data: editDoc } = useQuery({
    queryKey: ['document', editDocId],
    queryFn: () => getDocumentById(editDocId!),
    enabled: editDocId != null,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
    queryClient.invalidateQueries({ queryKey: ['admin-report-counts'] });
    // Le badge « Signalements » de la sidebar et la file documents suivent immédiatement.
    queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    queryClient.invalidateQueries({ queryKey: ['admin-all-docs'] });
    queryClient.invalidateQueries({ queryKey: ['admin-pending-docs'] });
    queryClient.invalidateQueries({ queryKey: ['search'] });
  };

  const decideMut = useMutation({
    mutationFn: ({ id, resolution, note }: { id: number; resolution: ReportResolution; note: string }) =>
      resolution === 'REJECTED'
        ? dismissReport(id, note || undefined)
        : resolveReport(id, { resolution, note: note || undefined }),
    onSuccess: () => {
      invalidate();
      setDecideOn(null);
    },
  });

  const quickDismissMut = useMutation({
    mutationFn: (id: number) => dismissReport(id),
    onSuccess: invalidate,
  });

  const reports = data?.content ?? [];
  const pendingTotal = Object.values(counts ?? {}).reduce((a, b) => a + b, 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t('admin.reports.title')}
        </Typography>
        <Typography variant="caption" color="text.secondary" className="mono">
          {t('admin.reports.pendingCount', { count: pendingTotal })}
        </Typography>
      </Box>

      {/* --- Filtres : le tri par problème est la raison d'être du champ `type`. --- */}
      <GlassCard sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <TextField
          select
          size="small"
          label={t('admin.reports.status')}
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          sx={{ maxWidth: 240 }}
        >
          <MenuItem value="PENDING">{t('admin.reports.statusPending')}</MenuItem>
          <MenuItem value="RESOLVED">{t('admin.reports.statusResolved')}</MenuItem>
          <MenuItem value="DISMISSED">{t('admin.reports.statusDismissed')}</MenuItem>
          <MenuItem value="ALL">{t('admin.reports.statusAll')}</MenuItem>
        </TextField>

        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {/* « Tous » d'abord et à position fixe — trouvable quel que soit le nombre de types. */}
          <Chip
            size="small"
            label={t('admin.reports.allTypes')}
            color={type === null ? 'primary' : 'default'}
            variant={type === null ? 'filled' : 'outlined'}
            onClick={() => setType(null)}
          />
          {REPORT_TYPES.map((rt) => {
            const n = counts?.[rt.id] ?? 0;
            return (
              <Chip
                key={rt.id}
                size="small"
                label={`${rt.emoji} ${t(`reportTypes.${rt.id}.label`)}${n > 0 ? ` · ${n}` : ''}`}
                color={type === rt.id ? rt.color : 'default'}
                variant={type === rt.id ? 'filled' : 'outlined'}
                // Re-cliquer le filtre actif le désélectionne (même grammaire que l'explorer).
                onClick={() => setType(type === rt.id ? null : rt.id)}
                sx={{ opacity: status === 'PENDING' && n === 0 && type !== rt.id ? 0.55 : 1 }}
              />
            );
          })}
        </Box>
      </GlassCard>

      {isLoading && <Typography color="text.secondary">{t('common.loading')}</Typography>}
      {!isLoading && !reports.length && (
        <GlassCard sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">{t('admin.reports.noPending')}</Typography>
        </GlassCard>
      )}

      {decideMut.isError && (
        <Alert severity="error" onClose={() => decideMut.reset()}>
          {(axios.isAxiosError(decideMut.error)
            ? (decideMut.error.response?.data as { message?: string } | undefined)?.message
            : null) || t('common.error')}
        </Alert>
      )}

      {reports.map((report) => {
        const meta = reportTypeMeta(report.type);
        const open = previewId === report.id;
        return (
          <GlassCard key={report.id} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                color={meta.color}
                variant="filled"
                label={`${meta.emoji} ${t(`reportTypes.${report.type}.label`)}`}
              />
              {/* Nouvel onglet : ouvrir le document ne doit pas faire perdre sa place dans la file. */}
              <Typography
                component={Link}
                to={`/documents/${report.documentId}`}
                target="_blank"
                rel="noopener"
                variant="body2"
                sx={{
                  fontWeight: 700,
                  color: 'primary.main',
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {report.documentTitle}
              </Typography>
              {!report.documentVerified && (
                <Chip size="small" variant="outlined" color="warning" label={t('document.pending')} />
              )}
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', textAlign: 'right' }}>
                {report.reporterUsername ?? t('document.anonymous')}
                {' · '}
                {formatRelativeDate(report.createdAt, i18n.language)}
              </Typography>
            </Box>

            <Typography variant="caption" color="text.secondary">
              #{report.documentId}
              {report.documentCourseName ? ` · ${report.documentCourseName}` : ''}
              {` · ${t(`categories.${report.documentCategory}`)}`}
              {report.documentAuthorName ? ` · ${t('admin.reports.by')} ${report.documentAuthorName}` : ''}
            </Typography>

            <Typography
              variant="body2"
              sx={{
                px: 1.5,
                py: 1,
                bgcolor: 'rgba(255,255,255,0.03)',
                borderRadius: 1,
                borderLeft: 3,
                borderColor: `${meta.color === 'default' ? 'divider' : `${meta.color}.main`}`,
                whiteSpace: 'pre-wrap',
              }}
            >
              {report.reason}
            </Typography>

            {/* Décision déjà prise : on montre CE QUI a été fait, pas seulement « traité ». */}
            {report.status !== 'PENDING' && (
              <Alert
                severity={report.status === 'DISMISSED' ? 'info' : 'success'}
                icon={<CheckCircleOutlined fontSize="inherit" />}
                sx={{ py: 0.25 }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  {t(`admin.reports.resolutions.${report.resolution ?? 'NO_ACTION'}.label`)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {report.resolvedByName ? `${report.resolvedByName} · ` : ''}
                  {report.resolvedAt ? formatDate(report.resolvedAt, i18n.language) : ''}
                  {report.resolutionNote ? ` — « ${report.resolutionNote} »` : ''}
                </Typography>
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Tooltip title={t('admin.docs.preview')}>
                <IconButton
                  size="small"
                  color={open ? 'primary' : 'default'}
                  onClick={() => setPreviewId(open ? null : report.id)}
                >
                  <PictureAsPdf fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('admin.docs.view')}>
                <IconButton size="small" component={Link} to={`/documents/${report.documentId}`} target="_blank">
                  <OpenInNew fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('admin.reports.editDoc')}>
                <IconButton size="small" onClick={() => setEditDocId(report.documentId)}>
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>

              {report.status === 'PENDING' && (
                <>
                  <Button
                    size="small"
                    color="inherit"
                    variant="outlined"
                    startIcon={<Cancel />}
                    onClick={() => quickDismissMut.mutate(report.id)}
                    disabled={quickDismissMut.isPending}
                  >
                    {t('admin.reports.dismiss')}
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<Gavel />}
                    onClick={() => setDecideOn(report)}
                  >
                    {t('admin.reports.decide')}
                  </Button>
                </>
              )}
            </Box>

            <Collapse in={open} unmountOnExit>
              <Box sx={{ pt: 1 }}>
                <Suspense fallback={<Typography variant="caption" color="text.secondary">{t('common.loading')}</Typography>}>
                  {open && <PdfViewer docId={report.documentId} title={report.documentTitle} />}
                </Suspense>
              </Box>
            </Collapse>
          </GlassCard>
        );
      })}

      {data && data.totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
          <Pagination
            count={data.totalPages}
            page={page + 1}
            onChange={(_, p) => setPage(p - 1)}
            color="primary"
            shape="rounded"
            size="small"
          />
        </Box>
      )}

      {decideOn && (
        <DecisionDialog
          report={decideOn}
          onClose={() => setDecideOn(null)}
          onConfirm={(resolution, note) => decideMut.mutate({ id: decideOn.id, resolution, note })}
          isPending={decideMut.isPending}
        />
      )}

      {editDoc && editDocId != null && (
        <DocumentEditDialog
          open
          doc={editDoc}
          mode="admin"
          onClose={() => setEditDocId(null)}
          onSaved={invalidate}
        />
      )}
    </Box>
  );
}

/**
 * « Traiter » : l'admin déclare ce qu'il fait, et le serveur le FAIT (retirer la vérification,
 * supprimer) avant de notifier le signaleur. C'est ce qui remplace le bouton vert qui ne faisait
 * que ranger la ligne.
 */
function DecisionDialog({ report, onClose, onConfirm, isPending }: {
  report: ReportResponse;
  onClose: () => void;
  onConfirm: (resolution: ReportResolution, note: string) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  // Pré-sélection selon le type signalé : on ouvre sur le choix le plus probable, jamais sur
  // « Supprimer » (une suppression se décide, elle ne se pré-coche pas).
  const [resolution, setResolution] = useState<ReportResolution>(() => suggestedResolution(report.type));
  const [note, setNote] = useState('');
  const destructive = resolution === 'DELETED';

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>
        {t('admin.reports.decideTitle')}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 400 }}>
          {report.documentTitle}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <RadioGroup value={resolution} onChange={(e) => setResolution(e.target.value as ReportResolution)}>
          {RESOLUTIONS.map((r) => (
            <FormControlLabel
              key={r.id}
              value={r.id}
              control={<Radio size="small" />}
              sx={{ alignItems: 'flex-start', mb: 0.5, '& .MuiRadio-root': { pt: 0.5 } }}
              label={
                <Box sx={{ py: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {r.emoji} {t(`admin.reports.resolutions.${r.id}.label`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`admin.reports.resolutions.${r.id}.hint`)}
                  </Typography>
                </Box>
              }
            />
          ))}
          <FormControlLabel
            value="REJECTED"
            control={<Radio size="small" />}
            sx={{ alignItems: 'flex-start', '& .MuiRadio-root': { pt: 0.5 } }}
            label={
              <Box sx={{ py: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  🚫 {t('admin.reports.resolutions.REJECTED.label')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('admin.reports.resolutions.REJECTED.hint')}
                </Typography>
              </Box>
            }
          />
        </RadioGroup>

        {destructive && (
          <Alert severity="warning" sx={{ mt: 1 }}>{t('admin.reports.deleteWarning')}</Alert>
        )}

        <TextField
          size="small"
          fullWidth
          multiline
          minRows={2}
          sx={{ mt: 2 }}
          label={t('admin.reports.note')}
          helperText={t('admin.reports.noteHelp')}
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 500))}
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">{t('common.cancel')}</Button>
        <Button
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          onClick={() => onConfirm(resolution, note.trim())}
          disabled={isPending}
        >
          {isPending ? t('common.loading') : t('admin.reports.confirmDecision')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
