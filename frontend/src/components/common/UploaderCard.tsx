import { Box, Typography, Chip, Button } from '@mui/material';
import { Verified, Bolt, School, FavoriteBorder, EmojiEvents } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getUserById, getUserRank, getDelegateHistory } from '@/api/endpoints';
import GlassCard from '@/components/ui/GlassCard';
import UserAvatar from '@/components/common/UserAvatar';
import UserBadges from '@/components/common/UserBadges';
import LevelChip from '@/components/common/LevelChip';

/**
 * Compact "shared by" card on the document page: surfaces the uploader's identity and
 * activity (XP, document count, section, verified) so readers can gauge reliability,
 * with a link to the full profile.
 */
export default function UploaderCard({ authorId }: { authorId: number }) {
  const { t } = useTranslation();
  const { data: u } = useQuery({
    queryKey: ['user', authorId],
    queryFn: () => getUserById(authorId),
    staleTime: 60_000,
  });

  const { data: rank } = useQuery({
    queryKey: ['user-rank', authorId],
    queryFn: () => getUserRank(authorId),
    staleTime: 60_000,
  });

  const { data: delegateHistory } = useQuery({
    queryKey: ['delegate-history', authorId],
    queryFn: () => getDelegateHistory(authorId),
    staleTime: 60_000,
  });

  if (!u) return null;

  const isDelegate = delegateHistory?.some((d) => d.active) ?? false;
  const isFormerDelegate = !isDelegate && (delegateHistory?.length ?? 0) > 0;

  return (
    <GlassCard sx={{ p: 2.5, mb: 3 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        {t('document.uploaderTitle')}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <UserAvatar username={u.username} url={u.avatarUrl} size={48} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {u.displayName}
            </Typography>
            {u.displayName !== u.username && (
              <Typography variant="caption" color="text.secondary">@{u.username}</Typography>
            )}
            {u.verified && (
              <Chip size="small" icon={<Verified sx={{ fontSize: 14 }} />} label={t('profile.verified')}
                    color="primary" variant="outlined" />
            )}
            {u.supporter && (
              <Chip size="small" icon={<FavoriteBorder sx={{ fontSize: 14 }} />} label={t('document.supporter')}
                    color="secondary" variant="outlined" />
            )}
            <UserBadges
              graduated={u.graduated}
              studyEndYear={u.studyEndYear}
              delegate={isDelegate}
              formerDelegate={isFormerDelegate}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary" className="mono" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Bolt sx={{ fontSize: 14 }} /> {u.xp} XP
            </Typography>
            <LevelChip xp={u.xp} dense />
            <Typography variant="caption" color="text.secondary" className="mono">
              {u.documentCount} {t('stats.docs').toLowerCase()}
            </Typography>
            {rank != null && (
              <Typography variant="caption" color="text.secondary" className="mono" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <EmojiEvents sx={{ fontSize: 14 }} /> #{rank}
              </Typography>
            )}
            {u.sectionName && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <School sx={{ fontSize: 14 }} /> {u.sectionName}
              </Typography>
            )}
          </Box>
        </Box>
        <Button component={Link} to={`/users/${u.id}`} size="small" variant="outlined">
          {t('document.viewProfile')}
        </Button>
      </Box>
    </GlassCard>
  );
}
