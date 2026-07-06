import { lazy, Suspense, useCallback, useState } from 'react';
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Skeleton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
} from '@mui/material';
import { EmojiEvents } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { motion, useReducedMotion } from 'framer-motion';
import { getLeaderboard, getUserById, getUserRank, getSections } from '@/api/endpoints';
import { STALE_15M } from '@/lib/constants';
import { useAuthStore } from '@/stores/useAuthStore';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';
import AdSlot from '@/components/ui/AdSlot';
import Divider from '@/components/ui/Divider';
import UserAvatar from '@/components/common/UserAvatar';
import UserBadges from '@/components/common/UserBadges';
import LevelChip, { levelNameSx } from '@/components/common/LevelChip';
import LevelProgress from '@/components/common/LevelProgress';
import type { LeaderboardEntry } from '@/types';
import * as s from './Leaderboard.styles';

const CommunityCarousel = lazy(() => import('@/components/home/CommunityCarousel'));

const MotionGlassCard = motion.create(GlassCard);
const MotionTableRow = motion.create(TableRow);

export default function Leaderboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const theme = useTheme();
  const currentUser = useAuthStore((st) => st.user);
  // Select de section (remplace le toggle « Toutes / Ma section ») : l'API acceptait déjà
  // n'importe quel sectionId, seul le frontend limitait à SA section.
  const [sectionFilter, setSectionFilter] = useState<number | ''>('');
  const filterSection = sectionFilter === '' ? undefined : sectionFilter;
  const { data: sections } = useQuery({ queryKey: ['sections'], queryFn: getSections, staleTime: STALE_15M });
  const { data: entries } = useQuery({
    queryKey: ['leaderboard', 100, filterSection ?? null],
    queryFn: () => getLeaderboard(100, filterSection),
  });

  // The podium splits off the top 3 — but only when there ARE at least 3 entries. With fewer
  // (a brand-new site, or "Ma section" with few members) we skip the podium and show everyone
  // in the table instead, otherwise users ranked 1-2 would vanish (podium hidden + sliced out).
  const showPodium = (entries?.length ?? 0) >= 3;
  const top3 = showPodium ? entries!.slice(0, 3) : [];
  const rest = showPodium ? entries!.slice(3) : (entries ?? []);

  const myEntry = currentUser
    ? entries?.find((e) => e.userId === currentUser.id) ?? null
    : null;

  // Au-delà du top 100 chargé, « Ta position » disparaissait — fallback sur le rang global exact
  // (une seule requête COUNT côté serveur). Uniquement en portée « Toutes » : le rang renvoyé est
  // global, il serait faux face à un classement filtré par section.
  const { data: fallbackRank } = useQuery({
    queryKey: ['user-rank', currentUser?.id],
    queryFn: () => getUserRank(currentUser!.id),
    enabled: !!currentUser && !!entries && !myEntry && filterSection === undefined,
  });

  // TanStack Query dedupes identical prefetches and serves from cache, so calling this on every
  // hover is cheap — the network request only fires the first time per user.
  const prefetchUser = useCallback(
    (userId: number) => {
      queryClient.prefetchQuery({
        queryKey: ['user', userId],
        queryFn: () => getUserById(userId),
        staleTime: 60_000,
      });
    },
    [queryClient]
  );

  // Stagger reveal — disabled for users who set prefers-reduced-motion.
  const fadeIn = (delay: number) =>
    reduceMotion
      ? { initial: false, animate: false }
      : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: 0.4, ease: 'easeOut' as const },
        };

  return (
    <PageWrapper>
      <Helmet><title>{t('nav.leaderboard')} · Freenote</title></Helmet>
      <Typography variant="h4" sx={s.title}>
        {t('leaderboard.title')}
      </Typography>

      <FormControl size="small" sx={{ mb: 3, minWidth: 220 }}>
        <InputLabel>{t('leaderboard.sectionFilter')}</InputLabel>
        <Select
          value={sectionFilter}
          label={t('leaderboard.sectionFilter')}
          onChange={(e) => setSectionFilter(e.target.value as number | '')}
        >
          <MenuItem value="">{t('leaderboard.scopeAll')}</MenuItem>
          {sections?.map((sec) => (
            <MenuItem key={sec.id} value={sec.id}>
              {sec.name}
              {currentUser?.sectionId === sec.id ? ` — ${t('leaderboard.scopeMine').toLowerCase()}` : ''}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* PODIUM TOP 3 — order is 2-1-3 visually on desktop, 1-2-3 on mobile via CSS order */}
      {top3.length === 3 && (
        <Box sx={s.podiumGrid} role="list" aria-label={t('leaderboard.title')}>
          {top3.map((e, i) => {
            const rank = e.rank as 1 | 2 | 3;
            return (
              <MotionGlassCard
                key={e.userId}
                role="listitem"
                tabIndex={0}
                aria-label={`#${rank} ${e.displayName}, ${e.xp} XP`}
                sx={s.podiumCard(rank)}
                onClick={() => navigate(`/users/${e.userId}`)}
                onMouseEnter={() => prefetchUser(e.userId)}
                onFocus={() => prefetchUser(e.userId)}
                onKeyDown={(ev: React.KeyboardEvent) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    navigate(`/users/${e.userId}`);
                  }
                }}
                {...fadeIn(i * 0.1)}
              >
                <EmojiEvents
                  sx={{
                    fontSize: rank === 1 ? 32 : 24,
                    color:
                      rank === 1
                        ? s.podiumColors.gold
                        : rank === 2
                          ? s.podiumColors.silver
                          : s.podiumColors.bronze,
                  }}
                />
                <Typography sx={s.podiumRank(rank)}>#{rank}</Typography>
                <UserAvatar username={e.username} url={e.avatarUrl} size={s.podiumAvatarSize(rank)} />
                <Typography sx={{ fontWeight: 700, mt: 0.5, ...levelNameSx(e.xp, theme.palette.mode) }}>
                  {e.displayName}
                </Typography>
                <Typography variant="body2" color="text.secondary" className="mono">
                  {e.xp} XP · {e.documentCount} {t('stats.docs').toLowerCase()}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center', mt: 0.5 }}>
                  <LevelChip xp={e.xp} dense />
                  <UserBadges
                    graduated={e.graduated}
                    studyEndYear={e.studyEndYear}
                    delegate={e.delegate}
                    formerDelegate={e.formerDelegate}
                    dense
                  />
                </Box>
              </MotionGlassCard>
            );
          })}
        </Box>
      )}

      {/* DESKTOP: table on left, sticky sidebar on right.
           MOBILE (<md): table is hidden, replaced by a vertical card list — no horizontal scroll. */}
      <Box sx={s.layoutGrid}>
        {/* Desktop / tablet table */}
        <GlassCard sx={{ display: { xs: 'none', md: 'block' } }}>
          <TableContainer sx={s.scrollableTable}>
            <Table stickyHeader aria-label={t('leaderboard.title')}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('leaderboard.rank')}</TableCell>
                  <TableCell>{t('leaderboard.username')}</TableCell>
                  <TableCell align="right">{t('leaderboard.xp')}</TableCell>
                  <TableCell align="right">{t('leaderboard.docs')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rest.map((entry, i) => {
                  const isMe = currentUser?.id === entry.userId;
                  return (
                    <MotionTableRow
                      key={entry.rank}
                      hover
                      tabIndex={0}
                      role="button"
                      aria-rowindex={entry.rank}
                      aria-label={`#${entry.rank} ${entry.displayName}, ${entry.xp} XP`}
                      sx={{ cursor: 'pointer', ...(isMe ? s.currentUserRow : {}) }}
                      onClick={() => navigate(`/users/${entry.userId}`)}
                      onMouseEnter={() => prefetchUser(entry.userId)}
                      onFocus={() => prefetchUser(entry.userId)}
                      onKeyDown={(ev: React.KeyboardEvent) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault();
                          navigate(`/users/${entry.userId}`);
                        }
                      }}
                      // Cap stagger at the first ~10 rows; beyond that the user is scrolling and
                      // the animation is invisible anyway.
                      {...fadeIn(Math.min(i, 10) * 0.04)}
                    >
                      <TableCell>
                        <Typography className="mono" sx={s.rankCell(false)}>
                          #{entry.rank}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={s.userCell}>
                          <UserAvatar username={entry.username} url={entry.avatarUrl} size={s.ROW_AVATAR_SIZE} />
                          <Typography variant="body2" sx={{ fontWeight: 600, ...levelNameSx(entry.xp, theme.palette.mode) }}>
                            {entry.displayName}
                          </Typography>
                          <LevelChip xp={entry.xp} dense />
                          {isMe && (
                            <Chip label={t('leaderboard.you')} size="small" color="primary" sx={{ ml: 1 }} />
                          )}
                          <UserBadges
                            graduated={entry.graduated}
                            studyEndYear={entry.studyEndYear}
                            delegate={entry.delegate}
                            formerDelegate={entry.formerDelegate}
                            dense
                          />
                        </Box>
                      </TableCell>
                      <TableCell align="right" className="mono">{entry.xp}</TableCell>
                      <TableCell align="right" className="mono">{entry.documentCount}</TableCell>
                    </MotionTableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </GlassCard>

        {/* Mobile cards — single column, vertical, no horizontal scroll. */}
        <Box sx={s.mobileList}>
          {rest.map((entry) => (
            <LeaderboardMobileCard
              key={entry.rank}
              entry={entry}
              isMe={currentUser?.id === entry.userId}
              onSelect={() => navigate(`/users/${entry.userId}`)}
              onPrefetch={() => prefetchUser(entry.userId)}
              t={t}
            />
          ))}
        </Box>

        <Box sx={s.sidebar}>
          {myEntry ? (
            <GlassCard sx={s.yourRankCard}>
              <Typography variant="caption" color="text.secondary">
                {t('leaderboard.yourRank')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main' }} className="mono">
                  #{myEntry.rank}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  / {entries?.length ?? '—'}
                </Typography>
              </Box>
              <Typography variant="body2" className="mono">
                {myEntry.xp} XP · {myEntry.documentCount} {t('stats.docs').toLowerCase()}
              </Typography>
              {/* Palier + progression vers le suivant — la carte n'était qu'un rang sec. */}
              <Box sx={{ mt: 1.5 }}>
                <LevelProgress xp={myEntry.xp} />
              </Box>
            </GlassCard>
          ) : currentUser && fallbackRank ? (
            <GlassCard sx={s.yourRankCard}>
              <Typography variant="caption" color="text.secondary">
                {t('leaderboard.yourRank')}
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main' }} className="mono">
                #{fallbackRank}
              </Typography>
              <Typography variant="body2" className="mono">
                {currentUser.xp} XP
              </Typography>
              <Box sx={{ mt: 1.5 }}>
                <LevelProgress xp={currentUser.xp} />
              </Box>
            </GlassCard>
          ) : null}
          <AdSlot width={300} height={250} />
        </Box>
      </Box>

      <Divider />
      <Suspense fallback={<Skeleton variant="rounded" height={200} sx={{ borderRadius: 3, mt: 2 }} />}>
        <CommunityCarousel />
      </Suspense>
    </PageWrapper>
  );
}

interface MobileCardProps {
  entry: LeaderboardEntry;
  isMe: boolean;
  onSelect: () => void;
  onPrefetch: () => void;
  t: (key: string) => string;
}

function LeaderboardMobileCard({ entry, isMe, onSelect, onPrefetch, t }: MobileCardProps) {
  const theme = useTheme();
  return (
    <GlassCard
      role="button"
      tabIndex={0}
      aria-label={`#${entry.rank} ${entry.displayName}, ${entry.xp} XP`}
      sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        cursor: 'pointer',
        ...(isMe ? s.currentUserRow : {}),
      }}
      onClick={onSelect}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          onSelect();
        }
      }}
    >
      <UserAvatar username={entry.username} url={entry.avatarUrl} size={s.ROW_AVATAR_SIZE} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" className="mono" sx={{ fontWeight: 700, color: 'primary.main' }}>
            #{entry.rank}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, ...levelNameSx(entry.xp, theme.palette.mode) }} noWrap>
            {entry.displayName}
          </Typography>
          {isMe && <Chip label={t('leaderboard.you')} size="small" color="primary" />}
        </Box>
        <Typography variant="caption" color="text.secondary" className="mono">
          {entry.xp} XP · {entry.documentCount} {t('stats.docs').toLowerCase()}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
          <LevelChip xp={entry.xp} dense />
          <UserBadges
            graduated={entry.graduated}
            studyEndYear={entry.studyEndYear}
            delegate={entry.delegate}
            formerDelegate={entry.formerDelegate}
            dense
          />
        </Box>
      </Box>
    </GlassCard>
  );
}
