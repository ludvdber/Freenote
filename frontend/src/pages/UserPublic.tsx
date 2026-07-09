import { useState, useEffect, type ReactNode } from 'react';
import { Typography, Box, Chip, Grid, Button, Pagination, useTheme } from '@mui/material';
import { GitHub, LinkedIn, Language, Edit, School, EmojiEvents, Bolt, Description, Visibility, Star } from '@mui/icons-material';
import { Coffee } from 'lucide-react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getUserById, getDelegateHistory, getDocumentsByUser, getUserRank, getUserStats,
  listQuizzes, listSharedDecks, listGuides,
} from '@/api/endpoints';
import { useAuthStore } from '@/stores/useAuthStore';
import { STALE_15M } from '@/lib/constants';
import { trackUse } from '@/lib/track';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';
import DocumentCard from '@/components/common/DocumentCard';
import OrbitalLoader from '@/components/ui/OrbitalLoader';
import UserAvatar from '@/components/common/UserAvatar';
import UserBadges from '@/components/common/UserBadges';
import DelegateMandates from '@/components/common/DelegateMandates';
import LevelChip, { levelNameSx } from '@/components/common/LevelChip';
import RevisionTile from '@/components/tools/revision/RevisionTile';
import GuideMiniCard from '@/components/common/GuideMiniCard';

/** Tuile de stat cliquable (ou non) — le corps du profil public était « 2 chiffres et une liste ». */
function StatTile({ icon, label, value, extra, to, hint }: {
  icon: ReactNode;
  label: string;
  value: string;
  extra?: ReactNode;
  to?: string;
  hint?: string;
}) {
  const clickable = Boolean(to);
  return (
    <GlassCard
      {...(clickable ? { component: RouterLink, to } : {})}
      aria-label={hint}
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        textDecoration: 'none',
        color: 'inherit',
        ...(clickable && { cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary', '& svg': { fontSize: 16 } }}>
        {icon}
        <Typography variant="caption">{label}</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h5" className="mono" sx={{ fontWeight: 800 }}>{value}</Typography>
        {extra}
      </Box>
    </GlassCard>
  );
}

export default function UserPublic() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);
  const currentUser = useAuthStore((s) => s.user);
  const isOwnProfile = currentUser?.id === userId;

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUserById(userId),
    enabled: !Number.isNaN(userId),
  });

  // Vue de profil anonyme (dédup 24 h côté serveur) — jamais sur son propre profil, et
  // seulement quand le compte existe (pas de comptage des 404).
  useEffect(() => {
    if (user && !isOwnProfile) trackUse('profile', String(userId));
  }, [user, isOwnProfile, userId]);

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

  // Vues cumulées + note moyenne reçue — les tuiles ci-dessous (endpoint dédié, comme /rank).
  const { data: stats } = useQuery({
    queryKey: ['user-stats', userId],
    queryFn: () => getUserStats(userId),
    enabled: !!user,
  });

  // Pagination des documents : les gros contributeurs dépassent vite les 6 par page —
  // sans elle, le profil n'en montrait JAMAIS plus de 6 (fix 2026-07-08).
  const [docPage, setDocPage] = useState(0);
  // Naviguer d'un profil à l'autre ne remonte pas le composant : reset de la page (render-adjust).
  const [prevUserId, setPrevUserId] = useState(userId);
  if (prevUserId !== userId) {
    setPrevUserId(userId);
    setDocPage(0);
  }
  const { data: docs } = useQuery({
    queryKey: ['user-docs', userId, docPage],
    queryFn: () => getDocumentsByUser(userId, docPage),
    enabled: !!user,
  });

  // Ses contributions au-delà des documents : quiz/paquets PUBLIÉS + guides écrits (2026-07-08).
  // Trois requêtes filtrées serveur (ownerId/authorId) — sections masquées quand vides.
  const { data: userQuizzes } = useQuery({
    queryKey: ['user-quizzes', userId],
    queryFn: () => listQuizzes({ ownerId: userId, size: 50 }),
    staleTime: STALE_15M,
    enabled: !!user,
  });
  const { data: userDecks } = useQuery({
    queryKey: ['user-decks', userId],
    queryFn: () => listSharedDecks({ ownerId: userId, size: 50 }),
    staleTime: STALE_15M,
    enabled: !!user,
  });
  const { data: userGuides } = useQuery({
    queryKey: ['user-guides', userId],
    queryFn: () => listGuides({ authorId: userId, size: 50 }),
    staleTime: STALE_15M,
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

  // « Contribution la plus appréciée » : son doc le mieux noté (parmi ceux ayant des votes),
  // départagé par le nombre de votes — données déjà chargées, zéro requête en plus.
  // Uniquement en page 1 : au-delà, la page courante ne contient pas forcément son best-of.
  const ratedDocs = docPage === 0 ? (docs?.content ?? []).filter((d) => d.ratingCount > 0) : [];
  const bestDoc = ratedDocs.length > 0
    ? ratedDocs.reduce((best, d) =>
        d.averageRating > best.averageRating
          || (d.averageRating === best.averageRating && d.ratingCount > best.ratingCount)
          ? d
          : best)
    : null;
  const otherDocs = (docs?.content ?? []).filter((d) => d.id !== bestDoc?.id);

  return (
    <PageWrapper maxWidth="md">
      <GlassCard sx={{ p: { xs: 3, md: 4 }, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
          <UserAvatar username={user.username} url={user.avatarUrl} size={64} />
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {/* Le pseudo prend la couleur du palier céleste (dégradé pour Galaxie). */}
              <Typography variant="h5" sx={{ fontWeight: 800, ...levelNameSx(user.xp, theme.palette.mode) }}>
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
            {/* Section ISFCE + rang + palier + badges communautaires. « Ancien délégué » n'est PAS mis
                ici : il apparaît dans l'encadré Délégués ci-dessous, avec les années début–fin. */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
              <LevelChip xp={user.xp} />
              {rank != null && (
                <Chip
                  icon={<EmojiEvents sx={{ fontSize: 14 }} />}
                  label={`#${rank}`}
                  size="small"
                  variant="outlined"
                  color="primary"
                  sx={{ fontSize: 11 }}
                  component={RouterLink}
                  to="/leaderboard"
                  clickable
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

      {/* Rangée de stat-tiles : le corps du profil n'était que « XP · N docs » en petit. */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, 1fr)' }, gap: 2, mb: 3 }}>
        <StatTile
          icon={<Bolt />}
          label={t('userPublic.statXp')}
          value={String(user.xp)}
          extra={<LevelChip xp={user.xp} dense />}
          to="/leaderboard"
          hint={t('userPublic.statXpHint')}
        />
        <StatTile
          icon={<Description />}
          label={t('userPublic.statDocs')}
          value={String(user.documentCount)}
        />
        <StatTile
          icon={<Visibility />}
          label={t('userPublic.statViews')}
          value={stats ? String(stats.totalViews) : '—'}
        />
        <StatTile
          icon={<Star />}
          label={t('userPublic.statAvgRating')}
          value={stats?.avgRatingReceived != null ? stats.avgRatingReceived.toFixed(1) : '—'}
        />
        {/* Vues de la page profil (compteur anonyme, dédup 24 h) — la demande « compteur de
            vues par profil » du panel admin, exposée à tout le monde. */}
        <StatTile
          icon={<Visibility />}
          label={t('userPublic.statProfileViews')}
          value={stats ? String(stats.profileViews) : '—'}
        />
      </Box>

      <DelegateMandates history={delegateHistory} title={t('delegates.title')} />

      {/* Sa contribution la plus appréciée, mise en avant avec un halo. */}
      {bestDoc && (
        <>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            {t('userPublic.bestContribution')}
          </Typography>
          <Box sx={{ mb: 3 }}>
            <DocumentCard document={bestDoc} haloStrength={0.6} />
          </Box>
        </>
      )}

      {otherDocs.length > 0 && (
        <>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            {t('userPublic.documentsTitle')}
          </Typography>
          <Grid container spacing={2}>
            {otherDocs.map((doc) => (
              <Grid key={doc.id} size={{ xs: 12, sm: 6 }}>
                <DocumentCard document={doc} />
              </Grid>
            ))}
          </Grid>
        </>
      )}
      {/* Gros contributeurs : plus de 6 docs = pagination (avant, tout au-delà était invisible). */}
      {(docs?.totalPages ?? 0) > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2.5 }}>
          <Pagination
            count={docs!.totalPages}
            page={docPage + 1}
            onChange={(_, p) => setDocPage(p - 1)}
            color="primary"
            size="small"
          />
        </Box>
      )}

      {/* Ses quiz et paquets publiés — mêmes tuiles que le hub /reviser, clic = jouer/réviser. */}
      {((userQuizzes?.content.length ?? 0) > 0 || (userDecks?.content.length ?? 0) > 0) && (
        <>
          <Typography variant="h6" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>
            {t('userPublic.revisionsTitle')}
          </Typography>
          <Grid container spacing={2}>
            {(userQuizzes?.content ?? []).map((q) => (
              <Grid key={`q-${q.id}`} size={{ xs: 12, sm: 6, md: 4 }}>
                <RevisionTile
                  type="quiz"
                  title={q.title}
                  unitCount={q.questionCount}
                  attemptCount={q.attemptCount}
                  onClick={() => navigate(`/outils/quiz#play=${q.id}`)}
                />
              </Grid>
            ))}
            {(userDecks?.content ?? []).map((d) => (
              <Grid key={`d-${d.id}`} size={{ xs: 12, sm: 6, md: 4 }}>
                <RevisionTile
                  type="deck"
                  title={d.title}
                  unitCount={d.cardCount}
                  onClick={() => navigate(`/outils/flashcards#deck=${d.id}`)}
                />
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* Ses guides (auteurs = admins/rédacteurs — la section n'apparaît que s'il en a). */}
      {(userGuides?.content.length ?? 0) > 0 && (
        <>
          <Typography variant="h6" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>
            {t('userPublic.guidesTitle')}
          </Typography>
          <Grid container spacing={2}>
            {(userGuides?.content ?? []).map((g) => (
              <Grid key={g.id} size={{ xs: 12, sm: 6 }}>
                <GuideMiniCard guide={g} />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </PageWrapper>
  );
}
