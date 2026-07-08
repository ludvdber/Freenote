import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { listQuizzes, listSharedDecks } from '@/api/endpoints';
import { STALE_15M } from '@/lib/constants';
import { useAuthStore } from '@/stores/useAuthStore';
import PageWrapper from '@/components/layout/PageWrapper';
import LibraryShell from '@/components/tools/revision/LibraryShell';
import RevisionTile from '@/components/tools/revision/RevisionTile';
import AccountContract from '@/components/tools/revision/AccountContract';
import type { RevisionLink } from '@/components/tools/revision/lib';

/** Une entrée du hub : un quiz OU un paquet publié, normalisés pour la même tuile. */
interface HubItem extends RevisionLink {
  id: number;
  title: string;
  type: 'quiz' | 'deck';
  ownerName: string;
  /** questions (quiz) ou cartes (paquet). */
  unitCount: number;
  /** parties jouées (quiz) — les paquets n'ont pas de compteur d'usage. */
  attemptCount: number;
}

/**
 * Hub « Réviser » (maquette B validée 2026-07-07, PUBLIC depuis 2026-07-08) : LA bibliothèque
 * commune des quiz et paquets publiés par la promo, rangée par section → cours — accessible en
 * un clic depuis la navbar. Un anonyme consulte et JOUE (hors classement — le contrat en bas
 * explique le deal) ; chaque tuile ouvre le bon outil (quiz → #play, paquet → #deck).
 */
export default function Reviser() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const [type, setType] = useState<'all' | 'quiz' | 'deck'>('all');

  const quizzes = useQuery({
    queryKey: ['reviser-quizzes'],
    queryFn: () => listQuizzes({ size: 100 }),
    staleTime: STALE_15M,
  });
  const decks = useQuery({
    queryKey: ['reviser-decks'],
    queryFn: () => listSharedDecks({ size: 100 }),
    staleTime: STALE_15M,
  });

  const loading = quizzes.isLoading || decks.isLoading;
  const error = quizzes.isError || decks.isError;

  const items: HubItem[] | null = loading || error ? null : [
    ...(quizzes.data?.content ?? []).map((q): HubItem => ({
      id: q.id, title: q.title, type: 'quiz', ownerName: q.ownerName,
      unitCount: q.questionCount, attemptCount: q.attemptCount,
      sectionId: q.sectionId, sectionName: q.sectionName, courseId: q.courseId, courseName: q.courseName,
    })),
    ...(decks.data?.content ?? []).map((d): HubItem => ({
      id: d.id, title: d.title, type: 'deck', ownerName: d.ownerName,
      unitCount: d.cardCount, attemptCount: 0,
      sectionId: d.sectionId, sectionName: d.sectionName, courseId: d.courseId, courseName: d.courseName,
    })),
  ].filter((it) => type === 'all' || it.type === type);

  const open = (it: HubItem) =>
    navigate(it.type === 'quiz' ? `/outils/quiz#play=${it.id}` : `/outils/flashcards#deck=${it.id}`);

  return (
    <PageWrapper>
      <Helmet>
        <title>{t('reviser.title')} · Freenote</title>
      </Helmet>

      <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
        <Typography sx={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 12, letterSpacing: 3,
          color: 'primary.main', textTransform: 'uppercase', mb: 1,
        }} aria-hidden="true">
          {'// '}{t('reviser.title')}
        </Typography>
        <Typography variant="h1" sx={{ fontWeight: 900, fontSize: { xs: '1.9rem', md: '2.3rem' }, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          {t('reviser.heroTitle')}{' '}
          <Box component="span" sx={{
            background: 'linear-gradient(90deg, #7b2ff7, #00d2ff)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          }}>
            {t('reviser.heroHighlight')}
          </Box>
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1.5, mb: 2, maxWidth: 640 }}>{t('reviser.intro')}</Typography>

        {/* Créer directement depuis le hub — sans repasser par /outils (demande 2026-07-08). */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3.5 }}>
          <Button variant="contained" size="small" onClick={() => navigate('/outils/quiz')}>
            ❓ {t('reviser.createQuiz')}
          </Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/outils/flashcards')}>
            🃏 {t('reviser.createDeck')}
          </Button>
        </Box>

        <LibraryShell
          items={items}
          loading={loading}
          error={error}
          layout="grid"
          searchPlaceholder={t('reviser.search')}
          emptyLabel={t('reviser.empty')}
          extraControls={
            <ToggleButtonGroup
              size="small"
              exclusive
              value={type}
              onChange={(_, v) => v && setType(v)}
              aria-label={t('reviser.typeFilter')}
            >
              <ToggleButton value="all">{t('reviser.typeAll')}</ToggleButton>
              <ToggleButton value="quiz">❓ {t('reviser.typeQuiz')}</ToggleButton>
              <ToggleButton value="deck">🃏 {t('reviser.typeDecks')}</ToggleButton>
            </ToggleButtonGroup>
          }
          renderItem={(it) => (
            <RevisionTile
              type={it.type}
              title={it.title}
              unitCount={it.unitCount}
              attemptCount={it.attemptCount}
              ownerName={it.ownerName}
              onClick={() => open(it)}
            />
          )}
        />

        {/* Anonyme : il peut jouer (hors classement) — le contrat deux colonnes explique le deal. */}
        {!token && (
          <Box sx={{ mt: 4 }}>
            <AccountContract
              free={(t('reviser.contractFree', { returnObjects: true }) as string[])}
              locked={(t('reviser.contractLocked', { returnObjects: true }) as string[])}
            />
          </Box>
        )}
      </Box>
    </PageWrapper>
  );
}
