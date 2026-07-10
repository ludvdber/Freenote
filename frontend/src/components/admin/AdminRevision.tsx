import { useState } from 'react';
import { Box, Typography, TextField, Button, Chip, Link as MuiLink, Alert } from '@mui/material';
import { OpenInNew } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  listQuizzes,
  listSharedDecks,
  adminUnpublishQuiz,
  adminUnpublishDeck,
} from '@/api/endpoints';
import GlassCard from '@/components/ui/GlassCard';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { extractApiError, formatRelativeDate } from '@/lib/utils';
import type { QuizSummary, FlashcardDeckSummary } from '@/types';

/** Cible de la ConfirmDialog de dépublication (quiz OU paquet). */
interface Candidate {
  kind: 'quiz' | 'deck';
  id: number;
  title: string;
}

/**
 * Modération des quiz/paquets PUBLIÉS (V18) : n'importe quel vérifié publie dans la bibliothèque
 * (lisible même par les anonymes depuis la révision publique), cet écran est l'outil de retrait
 * qui manquait. Dépublier ne détruit rien — le contenu redevient un enregistrement privé de son
 * auteur, qui reçoit une notification. Accessible aux admins ET aux modérateurs.
 */
export default function AdminRevision() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();

  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [candidate, setCandidate] = useState<Candidate | null>(null);

  // Volume école : une page de 100 suffit largement ; le filtre est client (même approche que les
  // bibliothèques du hub /reviser).
  const { data: quizzes, isLoading: loadingQuizzes } = useQuery({
    queryKey: ['admin-revision-quizzes'],
    queryFn: () => listQuizzes({ size: 100 }),
  });
  const { data: decks, isLoading: loadingDecks } = useQuery({
    queryKey: ['admin-revision-decks'],
    queryFn: () => listSharedDecks({ size: 100 }),
  });

  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
  const matches = (title: string, owner: string, course: string | null) =>
    !query.trim() || norm(`${title} ${owner} ${course ?? ''}`).includes(norm(query.trim()));

  const quizRows = (quizzes?.content ?? []).filter((q) => matches(q.title, q.ownerName, q.courseName));
  const deckRows = (decks?.content ?? []).filter((d) => matches(d.title, d.ownerName, d.courseName));

  const unpublishMut = useMutation({
    mutationFn: (c: Candidate) => (c.kind === 'quiz' ? adminUnpublishQuiz(c.id) : adminUnpublishDeck(c.id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-revision-quizzes'] });
      qc.invalidateQueries({ queryKey: ['admin-revision-decks'] });
      setCandidate(null);
    },
    onError: (e) => {
      setError(extractApiError(e));
      setCandidate(null);
    },
  });

  const scope = (item: QuizSummary | FlashcardDeckSummary) =>
    item.courseName ?? item.sectionName ?? null;

  const row = (kind: 'quiz' | 'deck', item: QuizSummary | FlashcardDeckSummary, meta: string) => (
    <GlassCard key={`${kind}-${item.id}`} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      <Box sx={{ flex: 1, minWidth: 200 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {item.title}
          {scope(item) && (
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              · {scope(item)}
            </Typography>
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('admin.revision.by', { name: item.ownerName })} · {meta} · {formatRelativeDate(item.createdAt, i18n.language)}
        </Typography>
      </Box>
      <MuiLink
        href={kind === 'quiz' ? `/outils/quiz#play=${item.id}` : `/outils/flashcards#deck=${item.id}`}
        target="_blank"
        rel="noopener"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 13 }}
      >
        {t('admin.revision.open')} <OpenInNew sx={{ fontSize: 14 }} />
      </MuiLink>
      <Button
        size="small"
        color="warning"
        variant="outlined"
        onClick={() => setCandidate({ kind, id: item.id, title: item.title })}
      >
        {t('admin.revision.unpublish')}
      </Button>
    </GlassCard>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('admin.revision.title')}</Typography>
        <Typography variant="body2" color="text.secondary">{t('admin.revision.hint')}</Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      <TextField
        size="small"
        placeholder={t('admin.revision.searchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={{ maxWidth: 420 }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t('admin.revision.quizzes')}</Typography>
        <Chip size="small" label={quizRows.length} />
      </Box>
      {loadingQuizzes && <Typography color="text.secondary">{t('common.loading')}</Typography>}
      {!loadingQuizzes && quizRows.length === 0 && (
        <Typography variant="body2" color="text.secondary">{t('admin.revision.emptyQuizzes')}</Typography>
      )}
      {quizRows.map((q) =>
        row('quiz', q, `${t('admin.revision.questionsCount', { count: q.questionCount })} · ${t('admin.revision.attemptsCount', { count: q.attemptCount })}`)
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t('admin.revision.decks')}</Typography>
        <Chip size="small" label={deckRows.length} />
      </Box>
      {loadingDecks && <Typography color="text.secondary">{t('common.loading')}</Typography>}
      {!loadingDecks && deckRows.length === 0 && (
        <Typography variant="body2" color="text.secondary">{t('admin.revision.emptyDecks')}</Typography>
      )}
      {deckRows.map((d) => row('deck', d, t('admin.revision.cardsCount', { count: d.cardCount })))}

      <ConfirmDialog
        open={Boolean(candidate)}
        title={t('admin.revision.unpublishTitle')}
        message={t('admin.revision.unpublishConfirm', { title: candidate?.title })}
        confirmLabel={t('admin.revision.unpublish')}
        confirmColor="warning"
        loading={unpublishMut.isPending}
        onConfirm={() => candidate && unpublishMut.mutate(candidate)}
        onClose={() => setCandidate(null)}
      />
    </Box>
  );
}
