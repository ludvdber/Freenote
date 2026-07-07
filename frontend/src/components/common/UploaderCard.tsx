import { Box, Typography, Chip, Button, type SxProps, type Theme } from '@mui/material';
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
export default function UploaderCard({ authorId, sx }: { authorId: number; sx?: SxProps<Theme> }) {
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
    // Pas de tableau ici : GlassCard spreade son sx dans un objet (`{ ...défauts, ...sx }`), un
    // tableau y deviendrait des clés numériques ignorées (padding perdu — bug vu en capture).
    // Le cast est sûr tant que les appelants passent un objet de style simple.
    <GlassCard sx={{ p: 2.5, mb: 3, ...(sx as object) }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        {t('document.uploaderTitle')}
      </Typography>
      {/* Layout pensé pour le rail 330 px : avatar + identité en tête, puis chips, puis stats
          sur une ligne — l'ancien flex horizontal y empilait tout dans une colonne étroite. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <UserAvatar username={u.username} url={u.avatarUrl} size={44} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
            {u.displayName}
          </Typography>
          {u.displayName !== u.username && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              @{u.username}
            </Typography>
          )}
        </Box>
      </Box>
      {(u.verified || u.supporter || isDelegate || isFormerDelegate || u.graduated) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mt: 1.25 }}>
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
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mt: 1.25 }}>
        <LevelChip xp={u.xp} dense />
        <Typography variant="caption" color="text.secondary" className="mono" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Bolt sx={{ fontSize: 14 }} /> {u.xp} XP
        </Typography>
        <Typography variant="caption" color="text.secondary" className="mono">
          {u.documentCount} {t('stats.docs').toLowerCase()}
        </Typography>
        {rank != null && (
          <Typography variant="caption" color="text.secondary" className="mono" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <EmojiEvents sx={{ fontSize: 14 }} /> #{rank}
          </Typography>
        )}
      </Box>
      {u.sectionName && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
          <School sx={{ fontSize: 14 }} /> {u.sectionName}
        </Typography>
      )}
      <Button component={Link} to={`/users/${u.id}`} size="small" variant="outlined" fullWidth sx={{ mt: 1.75 }}>
        {t('document.viewProfile')}
      </Button>
    </GlassCard>
  );
}
