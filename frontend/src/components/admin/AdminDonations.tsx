import { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Chip,
  Alert,
  Autocomplete,
  Collapse,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { CardGiftcard, Verified, ExpandMore, ExpandLess, PersonAddAlt1, DeleteOutlined } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getAdminDonations,
  adminGrantAdFree,
  adminAttachDonation,
  adminDeleteDonation,
  adminSearchUsers,
} from '@/api/endpoints';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, extractApiError } from '@/lib/utils';
import GlassCard from '@/components/ui/GlassCard';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import type { User, DonationResponse } from '@/types';

interface UserGroup {
  userId: number | null;
  username: string;
  donations: DonationResponse[];
  latestExpiry: string | null; // ISO timestamp
  kofiTotal: number;
  kofiCount: number;
  manualCount: number;
}

function groupByUser(items: DonationResponse[]): UserGroup[] {
  const map = new Map<string, UserGroup>();
  for (const d of items) {
    const key = d.userId !== null ? `u${d.userId}` : `k${d.kofiTransactionId}`;
    const isManual = d.kofiTransactionId.startsWith('MANUAL-');
    let g = map.get(key);
    if (!g) {
      g = {
        userId: d.userId,
        username: d.username ?? '?',
        donations: [],
        latestExpiry: null,
        kofiTotal: 0,
        kofiCount: 0,
        manualCount: 0,
      };
      map.set(key, g);
    }
    g.donations.push(d);
    if (d.adFreeUntil && (!g.latestExpiry || d.adFreeUntil > g.latestExpiry)) {
      g.latestExpiry = d.adFreeUntil;
    }
    if (isManual) g.manualCount += 1;
    else {
      g.kofiCount += 1;
      g.kofiTotal += Number(d.amount);
    }
  }
  // Newest first
  return [...map.values()].sort((a, b) => {
    if (!a.latestExpiry) return 1;
    if (!b.latestExpiry) return -1;
    return a.latestExpiry < b.latestExpiry ? 1 : -1;
  });
}

export default function AdminDonations() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();

  const [error, setError] = useState('');
  const [granted, setGranted] = useState('');
  const [grantUser, setGrantUser] = useState<User | null>(null);
  const [grantQuery, setGrantQuery] = useState('');
  const [grantDays, setGrantDays] = useState('30');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  // Rattachement d'un don orphelin (donateur sans code « FN-… ») à un compte.
  const [attachTarget, setAttachTarget] = useState<DonationResponse | null>(null);
  const [attachUser, setAttachUser] = useState<User | null>(null);
  const [attachQuery, setAttachQuery] = useState('');
  // Suppression d'une ligne de don (purge des dons de test) — confirmée avant d'agir.
  const [deleteTarget, setDeleteTarget] = useState<DonationResponse | null>(null);
  const debouncedGrantQuery = useDebounce(grantQuery, 300);
  const debouncedAttachQuery = useDebounce(attachQuery, 300);

  const { data: page, isLoading } = useQuery({
    queryKey: ['admin-donations'],
    queryFn: () => getAdminDonations(0, 50),
  });

  const { data: userOptions } = useQuery({
    queryKey: ['admin-users-search-grant', debouncedGrantQuery],
    queryFn: () => adminSearchUsers(debouncedGrantQuery, 20),
  });

  const { data: attachUserOptions } = useQuery({
    queryKey: ['admin-users-search-attach', debouncedAttachQuery],
    queryFn: () => adminSearchUsers(debouncedAttachQuery, 20),
    enabled: attachTarget !== null,
  });

  const attachMut = useMutation({
    mutationFn: () => {
      if (!attachTarget || !attachUser) throw new Error('User required');
      return adminAttachDonation(attachTarget.id, attachUser.id);
    },
    onSuccess: (d) => {
      setGranted(t('admin.donations.attached', { username: d.username ?? '?' }));
      setError('');
      setAttachTarget(null);
      setAttachUser(null);
      setAttachQuery('');
      qc.invalidateQueries({ queryKey: ['admin-donations'] });
      // Le don rattaché compte maintenant dans la jauge, et si l'admin se l'est rattaché à
      // LUI-MÊME, ses entitlements (palettes…) doivent se rafraîchir sans re-login.
      qc.invalidateQueries({ queryKey: ['funding'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e) => setError(extractApiError(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminDeleteDonation(id),
    onSuccess: () => {
      setGranted(t('admin.donations.deleted'));
      setError('');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['admin-donations'] });
      // La ligne comptait peut-être dans le thermomètre du mois — rafraîchir la jauge partout.
      qc.invalidateQueries({ queryKey: ['funding'] });
    },
    onError: (e) => setError(extractApiError(e)),
  });

  const grantMut = useMutation({
    mutationFn: () => {
      if (!grantUser) throw new Error('User required');
      const days = parseInt(grantDays, 10);
      if (!Number.isFinite(days) || days <= 0) throw new Error('Days must be > 0');
      return adminGrantAdFree(grantUser.id, days);
    },
    onSuccess: (d) => {
      setGranted(
        t('admin.donations.granted', {
          username: d.username ?? '?',
          until: d.adFreeUntil ? formatDate(d.adFreeUntil, i18n.language) : '—',
        })
      );
      setError('');
      setGrantUser(null);
      setGrantQuery('');
      qc.invalidateQueries({ queryKey: ['admin-donations'] });
    },
    onError: (e) => setError(extractApiError(e)),
  });

  const totalAmount = useMemo(() => {
    if (!page?.content) return 0;
    return page.content
      .filter((d) => !d.kofiTransactionId.startsWith('MANUAL-'))
      .reduce((sum, d) => sum + Number(d.amount), 0);
  }, [page]);

  const groups = useMemo(() => groupByUser(page?.content ?? []), [page]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {t('admin.donations.title')}
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {granted && (
        <Alert severity="success" onClose={() => setGranted('')}>
          {granted}
        </Alert>
      )}

      {/* Manual grant card */}
      <GlassCard sx={{ p: 2.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          {t('admin.donations.grantTitle')}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          {t('admin.donations.grantHelp')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Autocomplete<User, false, false, false>
            size="small"
            sx={{ minWidth: 240, flex: 1 }}
            options={userOptions ?? []}
            value={grantUser}
            onChange={(_, v) => setGrantUser(v)}
            onInputChange={(_, v) => setGrantQuery(v)}
            getOptionLabel={(u) => u.displayName !== u.username ? `${u.displayName} (@${u.username})` : u.username}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={(opts) => opts}
            noOptionsText={t('admin.delegates.userSearchEmpty')}
            renderInput={(params) => (
              <TextField {...params} label={t('admin.donations.user')} />
            )}
          />
          <TextField
            label={t('admin.donations.days')}
            type="number"
            size="small"
            value={grantDays}
            onChange={(e) => setGrantDays(e.target.value)}
            sx={{ width: 120 }}
            slotProps={{ htmlInput: { min: 1, max: 3650 } }}
          />
          <Button
            variant="contained"
            startIcon={<CardGiftcard />}
            disabled={!grantUser || grantMut.isPending}
            onClick={() => grantMut.mutate()}
          >
            {grantMut.isPending ? t('common.loading') : t('admin.donations.grant')}
          </Button>
        </Box>
      </GlassCard>

      {/* Summary */}
      <GlassCard sx={{ p: 2, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('admin.donations.totalCount')}
          </Typography>
          <Typography variant="h6" className="mono">
            {page?.totalElements ?? 0}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('admin.donations.totalAmount')}
          </Typography>
          <Typography variant="h6" className="mono">
            {totalAmount.toFixed(2)} €
          </Typography>
        </Box>
      </GlassCard>

      {isLoading && <Typography color="text.secondary">{t('common.loading')}</Typography>}
      {!isLoading && groups.length === 0 && (
        <GlassCard sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">{t('admin.donations.empty')}</Typography>
        </GlassCard>
      )}

      {/* One row per user — latest expiry wins. Click chevron to expand the audit history. */}
      {groups.map((g) => {
        const key = g.userId !== null ? `u${g.userId}` : `k${g.donations[0].kofiTransactionId}`;
        const expanded = expandedKey === key;
        const stillActive = g.latestExpiry && new Date(g.latestExpiry) > new Date();
        return (
          <GlassCard key={key} sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 180 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {g.username || t('admin.donations.unmatched')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('admin.donations.userSummary', {
                    kofi: g.kofiCount,
                    manual: g.manualCount,
                    amount: g.kofiTotal.toFixed(2),
                  })}
                </Typography>
              </Box>
              {stillActive && (
                <Chip
                  size="small"
                  variant="outlined"
                  color="success"
                  icon={<Verified sx={{ fontSize: 14 }} />}
                  label={t('admin.donations.active')}
                />
              )}
              {/* Un groupe non matché = exactement un don Ko-fi orphelin → rattachable. */}
              {g.userId === null && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PersonAddAlt1 />}
                  onClick={() => { setAttachTarget(g.donations[0]); setAttachUser(null); setAttachQuery(''); }}
                >
                  {t('admin.donations.attach')}
                </Button>
              )}
              <Box sx={{ minWidth: 180, textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {t('admin.donations.adFreeUntil')}
                </Typography>
                <Typography variant="body2" className="mono">
                  {g.latestExpiry ? formatDate(g.latestExpiry, i18n.language) : '—'}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => setExpandedKey(expanded ? null : key)}
                aria-label={expanded ? 'collapse' : 'expand'}
              >
                {expanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>

            <Collapse in={expanded}>
              <Box
                sx={{
                  mt: 2,
                  pt: 2,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                {g.donations
                  .slice()
                  .sort((a, b) => (a.createdAt ?? '') < (b.createdAt ?? '') ? 1 : -1)
                  .map((d) => {
                    const isManual = d.kofiTransactionId.startsWith('MANUAL-');
                    return (
                      <Box key={d.id} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                          <Chip
                            size="small"
                            variant={isManual ? 'outlined' : 'filled'}
                            color={isManual ? 'warning' : 'primary'}
                            label={
                              isManual
                                ? t('admin.donations.manualGrant')
                                : `${Number(d.amount).toFixed(2)} €`
                            }
                          />
                          <Typography variant="caption" color="text.secondary" className="mono" sx={{ flex: 1 }}>
                            #{d.kofiTransactionId}
                          </Typography>
                          {d.createdAt && (
                            <Typography variant="caption" color="text.secondary" className="mono">
                              {formatDate(d.createdAt, i18n.language)}
                            </Typography>
                          )}
                          <Typography variant="caption" className="mono">
                            {d.adFreeUntil ? formatDate(d.adFreeUntil, i18n.language) : '—'}
                          </Typography>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteTarget(d)}
                            aria-label={t('admin.donations.delete')}
                          >
                            <DeleteOutlined fontSize="small" />
                          </IconButton>
                        </Box>
                        {/* Le message Ko-fi peut contenir le code « FN-… » — précieux pour rattacher. */}
                        {d.message && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', pl: 0.5 }}>
                            « {d.message} »
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
              </Box>
            </Collapse>
          </GlassCard>
        );
      })}

      {/* Dialog de rattachement : choisir le compte qui recevra les avantages du don orphelin. */}
      <Dialog open={attachTarget !== null} onClose={() => setAttachTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>{t('admin.donations.attachTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {attachTarget && t('admin.donations.attachHelp', {
              amount: Number(attachTarget.amount).toFixed(2),
              message: attachTarget.message || '—',
            })}
          </DialogContentText>
          <Autocomplete<User, false, false, false>
            size="small"
            options={attachUserOptions ?? []}
            value={attachUser}
            onChange={(_, v) => setAttachUser(v)}
            onInputChange={(_, v) => setAttachQuery(v)}
            getOptionLabel={(u) => u.displayName !== u.username ? `${u.displayName} (@${u.username})` : u.username}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={(opts) => opts}
            noOptionsText={t('admin.delegates.userSearchEmpty')}
            renderInput={(params) => (
              <TextField {...params} label={t('admin.donations.user')} autoFocus />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAttachTarget(null)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            disabled={!attachUser || attachMut.isPending}
            onClick={() => attachMut.mutate()}
          >
            {attachMut.isPending ? t('common.loading') : t('admin.donations.attach')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Suppression d'une ligne (dons de test) — les avantages déjà appliqués ne sont PAS repris. */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('admin.donations.deleteTitle')}
        message={
          deleteTarget
            ? t('admin.donations.deleteConfirm', {
                amount: Number(deleteTarget.amount).toFixed(2),
                tx: deleteTarget.kofiTransactionId,
              })
            : ''
        }
        confirmLabel={t('admin.donations.delete')}
        loading={deleteMut.isPending}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
