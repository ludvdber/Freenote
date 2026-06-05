import { useState } from 'react';
import {
  Typography,
  TextField,
  Button,
  Box,
  Switch,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Grid,
  MenuItem,
} from '@mui/material';
import {
  Person,
  Link as LinkIcon,
  Settings,
  Star,
  FavoriteBorder,
  HowToVote,
  Verified,
  Bolt,
  DeleteForever,
  Visibility,
  AccountCircle,
  Badge as BadgeIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Link as RouterLink } from 'react-router-dom';
import {
  getCurrentUser,
  updateProfile,
  setSection as apiSetSection,
  getSections,
  deleteAccount,
  getDelegateHistory,
  getFavorites,
  syncDiscordRole,
} from '@/api/endpoints';
import { formatDate, extractApiError } from '@/lib/utils';
import GlassCard from '@/components/ui/GlassCard';
import { useAuthStore } from '@/stores/useAuthStore';
import PageWrapper from '@/components/layout/PageWrapper';
import UserAvatar from '@/components/common/UserAvatar';
import { useLogout } from '@/hooks/useLogout';
import type { AvatarSource } from '@/types';
import * as s from './Profile.styles';

const DICEBEAR_URL = (username: string) =>
  `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(username)}`;

const FAV_PREVIEW_COUNT = 8;

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { setUser } = useAuthStore();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: getCurrentUser });
  const { data: delegateHistory } = useQuery({
    queryKey: ['delegate-history', user?.id],
    queryFn: () => getDelegateHistory(user!.id),
    enabled: !!user?.id,
  });
  const { data: favorites } = useQuery({
    queryKey: ['my-favorites'],
    queryFn: () => getFavorites(0, FAV_PREVIEW_COUNT),
    enabled: !!user?.id,
  });
  const { data: sections = [] } = useQuery({ queryKey: ['sections'], queryFn: getSections });

  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [github, setGithub] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [discord, setDiscord] = useState('');
  const [profilePublic, setProfilePublic] = useState(true);
  const [showInCarousel, setShowInCarousel] = useState(true);
  const [avatarSource, setAvatarSource] = useState<AvatarSource>('AUTO');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayRealName, setDisplayRealName] = useState(false);
  const [sectionId, setSectionId] = useState<number | ''>('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Initialise the editable form from the loaded user. Adjusting state during render
  // (keyed on user.id) instead of an effect is React's recommended pattern and avoids a
  // cascading re-render. Re-syncs only when a different user is loaded, never while editing.
  const [prevUserId, setPrevUserId] = useState<number | undefined>(undefined);
  if (user && user.id !== prevUserId) {
    setPrevUserId(user.id);
    setBio(user.bio ?? '');
    setWebsite(user.website ?? '');
    setGithub(user.github ?? '');
    setLinkedin(user.linkedin ?? '');
    setDiscord(user.discord ?? '');
    setProfilePublic(user.profilePublic);
    setShowInCarousel(user.showInCarousel);
    setAvatarSource(user.avatarSource);
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
    setDisplayRealName(user.displayRealName);
    setSectionId(user.sectionId ?? '');
  }

  const isDirty = !!user && (
    bio !== (user.bio ?? '') ||
    website !== (user.website ?? '') ||
    github !== (user.github ?? '') ||
    linkedin !== (user.linkedin ?? '') ||
    discord !== (user.discord ?? '') ||
    profilePublic !== user.profilePublic ||
    showInCarousel !== user.showInCarousel ||
    avatarSource !== user.avatarSource ||
    firstName !== (user.firstName ?? '') ||
    lastName !== (user.lastName ?? '') ||
    displayRealName !== user.displayRealName ||
    (sectionId === '' ? null : sectionId) !== (user.sectionId ?? null)
  );

  const syncDiscordMutation = useMutation({ mutationFn: syncDiscordRole });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updated = await updateProfile({
        bio,
        website,
        github,
        linkedin,
        discord,
        profilePublic,
        showInCarousel,
        avatarSource,
        firstName,
        lastName,
        displayRealName,
      });
      const norm = sectionId === '' ? null : sectionId;
      // Section lives behind a dedicated endpoint; only call it when it actually changed.
      if (norm !== (user?.sectionId ?? null)) {
        return apiSetSection(norm);
      }
      return updated;
    },
    onSuccess: (u) => {
      queryClient.setQueryData(['me'], u);
      setUser(u);
      setSaveError('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (e: unknown) => setSaveError(extractApiError(e, t('common.error'))),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => logout(),
  });

  if (!user) return null;

  const previewUrl = (source: AvatarSource): string | null => {
    switch (source) {
      case 'LETTER': return null;
      case 'DICEBEAR': return DICEBEAR_URL(user.username);
      case 'AUTO': return null;
      // Use the raw Discord URL so the preview shows the real photo regardless of the active source
      // (previously it only rendered when DISCORD was already selected → a letter otherwise).
      case 'DISCORD': return user.discordAvatarUrl;
    }
  };

  const avatarOptions: { source: AvatarSource; available: boolean; reason?: string }[] = [
    { source: 'AUTO', available: true },
    { source: 'LETTER', available: true },
    { source: 'DICEBEAR', available: true },
    { source: 'DISCORD', available: true },
  ];

  return (
    <PageWrapper maxWidth="lg">
      <Helmet>
        <title>{t('profile.title')} — Freenote</title>
      </Helmet>

      {/* HEADER STRIP */}
      <GlassCard sx={s.headerCard}>
        <UserAvatar username={user.username} url={previewUrl(avatarSource)} size={64} />
        <Box sx={s.headerInfo}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            {user.displayName}
          </Typography>
          {user.displayName !== user.username && (
            <Typography variant="caption" color="text.secondary">
              @{user.username}
            </Typography>
          )}
          <Box sx={s.headerChips}>
            <Chip
              size="small"
              icon={<Bolt sx={{ fontSize: 14 }} />}
              label={`${user.xp} XP`}
              variant="outlined"
              color="primary"
            />
            {user.verified && (
              <Chip
                size="small"
                icon={<Verified sx={{ fontSize: 14 }} />}
                label={t('profile.verified')}
                variant="outlined"
                color="primary"
              />
            )}
            {user.supporter && (
              <Chip
                size="small"
                icon={<Star sx={{ fontSize: 14 }} />}
                label={t('profile.supporter')}
                variant="outlined"
                color="warning"
              />
            )}
          </Box>
        </Box>
        <Box sx={s.headerActions}>
          <Button
            variant="outlined"
            component={RouterLink}
            to={`/users/${user.id}`}
            startIcon={<Visibility />}
          >
            {t('profile.viewPublic')}
          </Button>
          <Button
            variant="contained"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !isDirty}
          >
            {saveMutation.isPending ? t('common.loading') : t('profile.save')}
          </Button>
        </Box>
      </GlassCard>

      {saved && (
        <Alert severity="success" sx={s.successAlert}>
          {t('profile.saved')} ✓
        </Alert>
      )}
      {saveError && (
        <Alert severity="error" sx={s.successAlert} onClose={() => setSaveError('')}>
          {saveError}
        </Alert>
      )}

      {/* 2-COLUMN BODY */}
      <Grid container spacing={3}>
        {/* LEFT — editable fields */}
        <Grid size={{ xs: 12, md: 7 }}>
          <GlassCard sx={s.sectionCard}>
            <Typography variant="subtitle1" sx={s.sectionTitle}>
              <Person fontSize="small" /> {t('profile.aboutSection')}
            </Typography>
            <TextField
              label={t('profile.bio')}
              multiline
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              fullWidth
              slotProps={{ htmlInput: { maxLength: 500 } }}
              helperText={`${bio.length}/500`}
            />
          </GlassCard>

          <GlassCard sx={s.sectionCard}>
            <Typography variant="subtitle1" sx={s.sectionTitle}>
              <BadgeIcon fontSize="small" /> {t('profile.identitySection')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              {t('profile.identityHelp')}
            </Typography>
            <Box sx={s.formStack}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  label={t('profile.firstName')}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  sx={{ flex: 1, minWidth: 200 }}
                  slotProps={{ htmlInput: { maxLength: 50 } }}
                />
                <TextField
                  label={t('profile.lastName')}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  sx={{ flex: 1, minWidth: 200 }}
                  slotProps={{ htmlInput: { maxLength: 50 } }}
                />
              </Box>
              <Box sx={s.switchRow}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Switch
                    checked={displayRealName}
                    onChange={(e) => setDisplayRealName(e.target.checked)}
                    disabled={!firstName && !lastName}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {t('profile.displayRealName')}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={s.switchHelp}>
                  {t('profile.displayRealNameHelp')}
                </Typography>
              </Box>
              <TextField
                select
                label={t('onboarding.sectionLabel')}
                helperText={t('onboarding.sectionHelp')}
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value === '' ? '' : Number(e.target.value))}
                sx={{ maxWidth: 360 }}
              >
                <MenuItem value="">{t('onboarding.sectionNone')}</MenuItem>
                {sections.map((sec) => (
                  <MenuItem key={sec.id} value={sec.id}>{sec.name}</MenuItem>
                ))}
              </TextField>
            </Box>
          </GlassCard>

          <GlassCard sx={s.sectionCard}>
            <Typography variant="subtitle1" sx={s.sectionTitle}>
              <AccountCircle fontSize="small" /> {t('profile.avatar.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              {t('profile.avatar.help')}
            </Typography>
            <Box sx={s.avatarOptions}>
              {avatarOptions.map(({ source, available, reason }) => {
                const selected = avatarSource === source;
                return (
                  <Box
                    key={source}
                    component="button"
                    type="button"
                    disabled={!available}
                    onClick={() => available && setAvatarSource(source)}
                    sx={s.avatarOption(selected, !available)}
                    aria-pressed={selected}
                    title={available ? '' : reason}
                  >
                    <UserAvatar
                      username={user.username}
                      url={previewUrl(source)}
                      size={56}
                    />
                    <Typography variant="caption" sx={{ fontWeight: 700, mt: 0.5 }}>
                      {t(`profile.avatar.source.${source}`)}
                    </Typography>
                    {!available && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                        {reason}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          </GlassCard>
        </Grid>

        {/* RIGHT — read-only summary + preferences (kept balanced with the left column) */}
        <Grid size={{ xs: 12, md: 5 }}>
          <GlassCard sx={s.sectionCard}>
            <Typography variant="subtitle1" sx={s.sectionTitle}>
              <Bolt fontSize="small" /> {t('profile.statsSection')}
            </Typography>
            <Box>
              <Box sx={s.statRow}>
                <Typography variant="body2" sx={s.statLabel}>
                  XP
                </Typography>
                <Typography sx={s.statValue} className="mono">
                  {user.xp}
                </Typography>
              </Box>
              <Box sx={s.statRow}>
                <Typography variant="body2" sx={s.statLabel}>
                  {t('profile.documentsPublished')}
                </Typography>
                <Typography sx={s.statValue} className="mono">
                  {user.documentCount}
                </Typography>
              </Box>
            </Box>
          </GlassCard>

          <GlassCard sx={s.sectionCard}>
            <Typography variant="subtitle1" sx={s.sectionTitle}>
              <LinkIcon fontSize="small" /> {t('profile.linksSection')}
            </Typography>
            <Box sx={s.formStack}>
              <TextField
                label={t('profile.website')}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                fullWidth
                placeholder="https://…"
              />
              <TextField
                label={t('profile.socialGithub')}
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                fullWidth
                placeholder="https://github.com/…"
              />
              <TextField
                label={t('profile.socialLinkedin')}
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                fullWidth
                placeholder="https://linkedin.com/in/…"
              />
              <TextField
                label={t('profile.socialDiscord')}
                value={discord}
                onChange={(e) => setDiscord(e.target.value)}
                fullWidth
                placeholder="username"
              />
            </Box>
          </GlassCard>

          <GlassCard sx={s.sectionCard}>
            <Typography variant="subtitle1" sx={s.sectionTitle}>
              <Settings fontSize="small" /> {t('profile.preferencesSection')}
            </Typography>
            <Box sx={s.formStack}>
              <Box sx={s.switchRow}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Switch
                    checked={profilePublic}
                    onChange={(e) => setProfilePublic(e.target.checked)}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {t('profile.public')}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={s.switchHelp}>
                  {t('profile.publicHelp')}
                </Typography>
              </Box>
              <Box sx={s.switchRow}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Switch
                    checked={showInCarousel}
                    onChange={(e) => setShowInCarousel(e.target.checked)}
                    disabled={!user.verified}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {t('profile.carousel')}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={s.switchHelp}>
                  {user.verified ? t('profile.carouselHelp') : t('profile.carouselLocked')}
                </Typography>
              </Box>
              <Box sx={s.switchRow}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<LinkIcon />}
                  onClick={() => syncDiscordMutation.mutate()}
                  disabled={syncDiscordMutation.isPending}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {t('profile.syncDiscordRole')}
                </Button>
                <Typography variant="caption" color="text.secondary" sx={s.switchHelp}>
                  {t('profile.syncDiscordRoleHelp')}
                </Typography>
              </Box>
              {syncDiscordMutation.isSuccess && (
                <Alert severity="success">{t('profile.syncDiscordRoleDone')}</Alert>
              )}
              {syncDiscordMutation.isError && (
                <Alert severity="error">{t('profile.syncDiscordRoleError')}</Alert>
              )}
            </Box>
          </GlassCard>

          <GlassCard sx={s.sectionCard}>
            <Typography variant="subtitle1" sx={s.sectionTitle}>
              <FavoriteBorder fontSize="small" />{' '}
              {favorites
                ? t('profile.favoritesTitle', { count: favorites.totalElements })
                : t('profile.favoritesTitle', { count: 0 })}
            </Typography>
            {favorites && favorites.content.length > 0 ? (
              <Box sx={s.favoritesList}>
                {favorites.content.map((d) => (
                  <Box
                    key={d.id}
                    component={RouterLink}
                    to={`/documents/${d.id}`}
                    sx={s.favoriteItem}
                  >
                    <Typography variant="body2" sx={s.favoriteTitle} noWrap>
                      {d.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ display: 'block' }}
                    >
                      {d.courseName}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t('profile.noFavorites')}
              </Typography>
            )}
          </GlassCard>

          {delegateHistory && delegateHistory.length > 0 && (
            <GlassCard sx={s.sectionCard}>
              <Typography variant="subtitle1" sx={s.sectionTitle}>
                <HowToVote fontSize="small" /> {t('profile.delegationSection')}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {delegateHistory.map((dh) => (
                  <Box key={dh.id} sx={s.mandateRow}>
                    <Chip
                      label={
                        dh.active
                          ? t('admin.delegates.activeChip')
                          : t('admin.delegates.endedChip')
                      }
                      size="small"
                      color={dh.active ? 'success' : 'default'}
                      variant="outlined"
                      sx={{ fontSize: 11 }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {dh.sectionName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" className="mono">
                      {formatDate(dh.startDate, i18n.language)}
                      {dh.endDate ? ` → ${formatDate(dh.endDate, i18n.language)}` : ` → …`}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </GlassCard>
          )}
        </Grid>
      </Grid>

      {/* DANGER ZONE */}
      <GlassCard sx={s.dangerCard}>
        <Box sx={s.dangerHeader}>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'error.main', mb: 0.5 }}>
              {t('profile.dangerZone')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('profile.dangerZoneHelp')}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteForever />}
            onClick={() => setDeleteDialogOpen(true)}
          >
            {t('profile.deleteAccount')}
          </Button>
        </Box>
      </GlassCard>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle color="error">{t('profile.deleteAccount')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('profile.deleteConfirm')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setDeleteDialogOpen(false);
              deleteMutation.mutate();
            }}
          >
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </PageWrapper>
  );
}
