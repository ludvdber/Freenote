import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Chip,
  Tooltip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import { Verified, GppBad, Shield, DeleteForever, Block, Bolt, Palette, LocalPolice, HistoryEdu } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  adminSearchUsers,
  adminVerifyUser,
  adminUnverifyUser,
  adminTrustUser,
  adminUntrustUser,
  adminGrantModerator,
  adminRevokeModerator,
  adminGrantEditor,
  adminRevokeEditor,
  adminGrantLifetimePalettes,
  adminRevokeLifetimePalettes,
  adminUpdateUserRole,
  adminDeleteUser,
  adminBanUser,
  getSections,
} from '@/api/endpoints';
import GlassCard from '@/components/ui/GlassCard';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { extractApiError } from '@/lib/utils';
import type { User } from '@/types';

type Role = 'USER' | 'VERIFIED' | 'ADMIN';

export default function AdminUsers() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [query, setQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState<number | ''>('');
  const [error, setError] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState<User | null>(null);
  const [banCandidate, setBanCandidate] = useState<User | null>(null);
  const [banReason, setBanReason] = useState('');
  // Changement de rôle confirmé avant mutation — un mauvais clic dans le Select promouvait
  // ADMIN (ou retirait la vérification) immédiatement, sans garde-fou.
  const [roleCandidate, setRoleCandidate] = useState<{ user: User; role: Role } | null>(null);

  const { data: sections = [] } = useQuery({ queryKey: ['sections'], queryFn: getSections });
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users', query, sectionFilter],
    queryFn: () => adminSearchUsers(query, 50, sectionFilter === '' ? undefined : sectionFilter),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-users'] });

  const verifyMut = useMutation({
    mutationFn: adminVerifyUser,
    onSuccess: invalidate,
    onError: (e) => setError(extractApiError(e)),
  });

  const unverifyMut = useMutation({
    mutationFn: adminUnverifyUser,
    onSuccess: invalidate,
    onError: (e) => setError(extractApiError(e)),
  });

  const trustMut = useMutation({
    mutationFn: adminTrustUser,
    onSuccess: invalidate,
    onError: (e) => setError(extractApiError(e)),
  });

  const untrustMut = useMutation({
    mutationFn: adminUntrustUser,
    onSuccess: invalidate,
    onError: (e) => setError(extractApiError(e)),
  });

  // Rôles staff V18 : Modérateur (périmètre Modération du panel) et Rédacteur (guides). Relus
  // live en DB côté serveur — l'octroi/le retrait est effectif à la requête suivante, sans re-login.
  const grantModeratorMut = useMutation({
    mutationFn: adminGrantModerator,
    onSuccess: invalidate,
    onError: (e) => setError(extractApiError(e)),
  });
  const revokeModeratorMut = useMutation({
    mutationFn: adminRevokeModerator,
    onSuccess: invalidate,
    onError: (e) => setError(extractApiError(e)),
  });
  const grantEditorMut = useMutation({
    mutationFn: adminGrantEditor,
    onSuccess: invalidate,
    onError: (e) => setError(extractApiError(e)),
  });
  const revokeEditorMut = useMutation({
    mutationFn: adminRevokeEditor,
    onSuccess: invalidate,
    onError: (e) => setError(extractApiError(e)),
  });

  // Palettes à vie : le flag lifetime_supporter (même avantage qu'un don ≥ 5 €). Si l'admin se
  // l'accorde à lui-même, son propre profil doit se rafraîchir → invalider aussi ['me'].
  const invalidateWithMe = () => {
    invalidate();
    qc.invalidateQueries({ queryKey: ['me'] });
  };
  const grantPalettesMut = useMutation({
    mutationFn: adminGrantLifetimePalettes,
    onSuccess: invalidateWithMe,
    onError: (e) => setError(extractApiError(e)),
  });
  const revokePalettesMut = useMutation({
    mutationFn: adminRevokeLifetimePalettes,
    onSuccess: invalidateWithMe,
    onError: (e) => setError(extractApiError(e)),
  });

  const roleMut = useMutation({
    mutationFn: ({ id, role }: { id: number; role: Role }) => adminUpdateUserRole(id, role),
    onSuccess: () => {
      invalidate();
      setRoleCandidate(null);
    },
    onError: (e) => {
      setError(extractApiError(e));
      setRoleCandidate(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: adminDeleteUser,
    onSuccess: () => {
      invalidate();
      setDeleteCandidate(null);
    },
    onError: (e) => setError(extractApiError(e)),
  });

  const banMut = useMutation({
    // La raison (optionnelle) alimente la table `bans` — l'API l'acceptait déjà, l'UI ne l'offrait pas.
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => adminBanUser(id, reason),
    onSuccess: () => {
      invalidate();
      setBanCandidate(null);
      setBanReason('');
    },
    onError: (e) => setError(extractApiError(e)),
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {t('admin.users.title')}
      </Typography>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder={t('admin.users.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ flex: 1, minWidth: 200 }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>{t('admin.users.sectionFilter')}</InputLabel>
          <Select<number | ''>
            value={sectionFilter}
            label={t('admin.users.sectionFilter')}
            onChange={(e) => setSectionFilter(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <MenuItem value="">{t('admin.users.sectionAll')}</MenuItem>
            {sections.map((sec) => (
              <MenuItem key={sec.id} value={sec.id}>{sec.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {isLoading && <Typography color="text.secondary">{t('common.loading')}</Typography>}
      {!isLoading && !users?.length && (
        <GlassCard sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">{t('admin.users.empty')}</Typography>
        </GlassCard>
      )}

      {users?.map((u: User) => (
        <GlassCard key={u.id} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 180 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{u.displayName}</Typography>
            {u.displayName !== u.username && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                @{u.username}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {t('admin.users.xp', { xp: u.xp })}
              {u.sectionName ? ` · ${u.sectionName}` : ''}
            </Typography>
            {u.discord && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {t('admin.users.discord')} : {u.discord}
              </Typography>
            )}
          </Box>

          {u.verified ? (
            <Chip size="small" color="success" icon={<Verified />} label={t('admin.users.verified')} />
          ) : (
            <Chip size="small" color="default" icon={<GppBad />} label={t('admin.users.unverified')} />
          )}

          {u.trusted && (
            <Tooltip title={t('admin.users.trustedHint')}>
              <Chip size="small" color="primary" icon={<Bolt />} label={t('admin.users.trustedChip')} sx={{ cursor: 'help' }} />
            </Tooltip>
          )}

          {u.moderator && (
            <Tooltip title={t('admin.users.moderatorHint')}>
              <Chip size="small" color="warning" icon={<LocalPolice />} label={t('admin.users.moderatorChip')} sx={{ cursor: 'help' }} />
            </Tooltip>
          )}

          {u.editor && (
            <Tooltip title={t('admin.users.editorHint')}>
              <Chip size="small" color="info" icon={<HistoryEdu />} label={t('admin.users.editorChip')} sx={{ cursor: 'help' }} />
            </Tooltip>
          )}

          {u.lifetimeSupporter && (
            <Tooltip title={t('admin.users.palettesHint')}>
              <Chip size="small" color="secondary" icon={<Palette />} label={t('admin.users.palettesChip')} sx={{ cursor: 'help' }} />
            </Tooltip>
          )}

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>{t('admin.users.role')}</InputLabel>
            <Select
              value={(u.role as Role | null) ?? 'USER'}
              label={t('admin.users.role')}
              onChange={(e) => {
                const role = e.target.value as Role;
                if (role !== ((u.role as Role | null) ?? 'USER')) setRoleCandidate({ user: u, role });
              }}
            >
              <MenuItem value="USER">USER</MenuItem>
              <MenuItem value="VERIFIED">VERIFIED</MenuItem>
              <MenuItem value="ADMIN">ADMIN</MenuItem>
            </Select>
          </FormControl>

          {u.verified ? (
            <Tooltip title={t('admin.users.unverify')}>
              <IconButton size="small" color="warning" onClick={() => unverifyMut.mutate(u.id)}>
                <Shield fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={<Verified />}
              onClick={() => verifyMut.mutate(u.id)}
            >
              {t('admin.users.verify')}
            </Button>
          )}

          <Tooltip title={u.trusted ? t('admin.users.untrust') : t('admin.users.trust')}>
            <IconButton
              size="small"
              color={u.trusted ? 'primary' : 'default'}
              onClick={() => (u.trusted ? untrustMut : trustMut).mutate(u.id)}
            >
              <Bolt fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title={u.moderator ? t('admin.users.revokeModerator') : t('admin.users.grantModerator')}>
            <IconButton
              size="small"
              color={u.moderator ? 'warning' : 'default'}
              onClick={() => (u.moderator ? revokeModeratorMut : grantModeratorMut).mutate(u.id)}
            >
              <LocalPolice fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title={u.editor ? t('admin.users.revokeEditor') : t('admin.users.grantEditor')}>
            <IconButton
              size="small"
              color={u.editor ? 'info' : 'default'}
              onClick={() => (u.editor ? revokeEditorMut : grantEditorMut).mutate(u.id)}
            >
              <HistoryEdu fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title={u.lifetimeSupporter ? t('admin.users.revokePalettes') : t('admin.users.grantPalettes')}>
            <IconButton
              size="small"
              color={u.lifetimeSupporter ? 'secondary' : 'default'}
              onClick={() => (u.lifetimeSupporter ? revokePalettesMut : grantPalettesMut).mutate(u.id)}
            >
              <Palette fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title={t('admin.users.delete')}>
            <IconButton size="small" color="error" onClick={() => setDeleteCandidate(u)}>
              <DeleteForever fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('admin.users.ban')}>
            <IconButton size="small" color="error" onClick={() => setBanCandidate(u)}>
              <Block fontSize="small" />
            </IconButton>
          </Tooltip>
        </GlassCard>
      ))}

      <ConfirmDialog
        open={Boolean(deleteCandidate)}
        title={t('admin.users.deleteTitle')}
        message={t('admin.users.deleteConfirm', { username: deleteCandidate?.username })}
        confirmLabel={t('common.confirm')}
        loading={deleteMut.isPending}
        onConfirm={() => deleteCandidate && deleteMut.mutate(deleteCandidate.id)}
        onClose={() => setDeleteCandidate(null)}
      />

      <ConfirmDialog
        open={Boolean(banCandidate)}
        title={t('admin.users.banTitle')}
        message={
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
            <span>{t('admin.users.banConfirm', { username: banCandidate?.username })}</span>
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={2}
              label={t('admin.users.banReasonLabel')}
              value={banReason}
              onChange={(e) => setBanReason(e.target.value.slice(0, 1000))}
              helperText={t('admin.users.banReasonHint')}
            />
          </Box>
        }
        confirmLabel={t('admin.users.ban')}
        confirmColor="error"
        loading={banMut.isPending}
        onConfirm={() => banCandidate && banMut.mutate({ id: banCandidate.id, reason: banReason.trim() || undefined })}
        onClose={() => { setBanCandidate(null); setBanReason(''); }}
      />

      <ConfirmDialog
        open={Boolean(roleCandidate)}
        title={t('admin.users.roleTitle')}
        message={
          roleCandidate?.role === 'USER'
            ? `${t('admin.users.roleConfirm', { username: roleCandidate?.user.username, role: roleCandidate?.role })} ${t('admin.users.roleConfirmUnverify')}`
            : t('admin.users.roleConfirm', { username: roleCandidate?.user.username, role: roleCandidate?.role })
        }
        confirmLabel={t('common.confirm')}
        confirmColor="warning"
        loading={roleMut.isPending}
        onConfirm={() => roleCandidate && roleMut.mutate({ id: roleCandidate.user.id, role: roleCandidate.role })}
        onClose={() => setRoleCandidate(null)}
      />
    </Box>
  );
}
