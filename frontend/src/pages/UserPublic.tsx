import { Typography, Box, Chip, Grid, Button } from '@mui/material';
import { GitHub, LinkedIn, Language, Edit, School, EmojiEvents } from '@mui/icons-material';
import { Coffee } from 'lucide-react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getUserById, getDelegateHistory, getDocumentsByUser, getUserRank } from '@/api/endpoints';
import { useAuthStore } from '@/stores/useAuthStore';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';
import DocumentCard from '@/components/common/DocumentCard';
import OrbitalLoader from '@/components/ui/OrbitalLoader';
import UserAvatar from '@/components/common/UserAvatar';
import UserBadges from '@/components/common/UserBadges';
import DelegateMandates from '@/components/common/DelegateMandates';

export default function UserPublic() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);
  const currentUser = useAuthStore((s) => s.user);
  const isOwnProfile = currentUser?.id === userId;

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUserById(userId),
    enabled: !Number.isNaN(userId),
  });

  const { data: delegateHistory } = useQuery({
    queryKey: ['delegate-history', userId],
    queryFn: () => getDelegateHistory(userId),
    enabled: !!user,
  });

  const { data: rank } = useQuery({
    queryKey: ['user-rank', userId],
    queryFn: () => getUserRank(userId),
    enabled: !!user,
  });

  const { data: docs } = useQuery({
    queryKey: ['user-docs', userId],
    queryFn: () => getDocumentsByUser(userId),
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <PageWrapper maxWidth="md">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <OrbitalLoader size={48} />
        </Box>
      </PageWrapper>
    );
  }

  if (!user) {
    return (
      <PageWrapper maxWidth="md">
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{t('userPublic.notFound')}</Typography>
        </Box>
      </PageWrapper>
    );
  }

  const isDelegate = delegateHistory?.some((d) => d.active) ?? false;

  return (
    <PageWrapper maxWidth="md">
      <GlassCard sx={{ p: { xs: 3, md: 4 }, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
          <UserAvatar username={user.username} url={user.avatarUrl} size={64} />
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {user.displayName}
              </Typography>
              {user.supporter && (
                <Coffee size={18} color="#ffd93d" />
              )}
            </Box>
            {user.displayName !== user.username && (
              <Typography variant="caption" color="text.secondary">
                @{user.username}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary" className="mono">
              {user.xp} XP · {user.documentCount} {t('stats.docs').toLowerCase()}
            </Typography>
            {/* Section ISFCE + rang + badges communautaires. « Ancien délégué » n'est PAS mis ici :
                il apparaît dans l'encadré Délégués ci-dessous, avec les années début–fin. */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
              {rank != null && (
                <Chip
                  icon={<EmojiEvents sx={{ fontSize: 14 }} />}
                  label={`#${rank}`}
                  size="small"
                  variant="outlined"
                  color="primary"
                  sx={{ fontSize: 11 }}
                />
              )}
              {user.sectionName && (
                <Chip
                  icon={<School sx={{ fontSize: 14 }} />}
                  label={user.sectionName}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: 11 }}
                />
              )}
              <UserBadges
                graduated={user.graduated}
                studyEndYear={user.studyEndYear}
                delegate={isDelegate}
                formerDelegate={false}
              />
            </Box>
            {/* Fallback année d'arrivée pour les non-diplômés. */}
            {!(user.graduated && user.studyEndYear) && user.studyStartYear && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                {t('profile.journey.sinceYear', { year: user.studyStartYear })}
              </Typography>
            )}
          </Box>

          {isOwnProfile && (
            <Button
              variant="contained"
              size="small"
              component={RouterLink}
              to="/profile"
              startIcon={<Edit />}
            >
              {t('userPublic.editProfile')}
            </Button>
          )}

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {user.website && (
              <Chip
                icon={<Language sx={{ fontSize: 16 }} />}
                label={t('profile.website')}
                size="small"
                variant="outlined"
                component="a"
                href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
                target="_blank"
                rel="noopener noreferrer"
                clickable
              />
            )}
            {user.github && (
              <Chip
                icon={<GitHub sx={{ fontSize: 16 }} />}
                label="GitHub"
                size="small"
                variant="outlined"
                component="a"
                href={user.github.startsWith('http') ? user.github : `https://github.com/${user.github}`}
                target="_blank"
                rel="noopener noreferrer"
                clickable
              />
            )}
            {user.linkedin && (
              <Chip
                icon={<LinkedIn sx={{ fontSize: 16 }} />}
                label="LinkedIn"
                size="small"
                variant="outlined"
                component="a"
                href={user.linkedin.startsWith('http') ? user.linkedin : `https://linkedin.com/in/${user.linkedin}`}
                target="_blank"
                rel="noopener noreferrer"
                clickable
              />
            )}
            {user.discord && (
              <Chip
                label={`Discord: ${user.discord}`}
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        </Box>

        {user.bio && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, lineHeight: 1.7 }}>
            {user.bio}
          </Typography>
        )}

      </GlassCard>

      <DelegateMandates history={delegateHistory} title={t('delegates.title')} />

      {docs && docs.content.length > 0 && (
        <>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            {t('profile.documents')}
          </Typography>
          <Grid container spacing={2}>
            {docs.content.map((doc) => (
              <Grid key={doc.id} size={{ xs: 12, sm: 6 }}>
                <DocumentCard document={doc} />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </PageWrapper>
  );
}
