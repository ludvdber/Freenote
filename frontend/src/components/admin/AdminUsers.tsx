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
import { Verified, GppBad, Shield, DeleteForever, Block } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  adminSearchUsers,
  adminVerifyUser,
  adminUnverifyUser,
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

  const roleMut = useMutation({
    mutationFn: ({ id, role }: { id: number; role: Role }) => adminUpdateUserRole(id, role),
    onSuccess: invalidate,
    onError: (e) => setError(extractApiError(e)),
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
    mutationFn: (id: number) => adminBanUser(id),
    onSuccess: () => {
      invalidate();
      setBanCandidate(null);
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

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>{t('admin.users.role')}</InputLabel>
            <Select
              value={(u.role as Role | null) ?? 'USER'}
              label={t('admin.users.role')}
              onChange={(e) => roleMut.mutate({ id: u.id, role: e.target.value as Role })}
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
        message={t('admin.users.banConfirm', { username: banCandidate?.username })}
        confirmLabel={t('admin.users.ban')}
        confirmColor="error"
        loading={banMut.isPending}
        onConfirm={() => banCandidate && banMut.mutate(banCandidate.id)}
        onClose={() => setBanCandidate(null)}
      />
    </Box>
  );
}
