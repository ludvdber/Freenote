import { useState } from 'react';
import { Box, Typography, IconButton, Tooltip, Chip, Tabs, Tab } from '@mui/material';
import { Delete, OpenInNew } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  listQuizzes, deleteQuiz,
  listSharedDecks, deleteSharedDeck,
  listSharedGanttCharts, deleteGanttChart,
} from '@/api/endpoints';
import { formatDate } from '@/lib/utils';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import GlassCard from '@/components/ui/GlassCard';

/**
 * Modération des contenus partagés par les étudiants via les outils : quiz publiés, paquets de
 * flashcards publiés, projets Gantt partagés. Réutilise les endpoints de bibliothèque (l'admin est
 * vérifié) + les DELETE qui autorisent owner-ou-admin. Sans cet onglet, ces contenus n'avaient
 * AUCUNE surface de modération.
 */
export default function AdminTools() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<'quiz' | 'decks' | 'gantt'>('quiz');
  const [candidate, setCandidate] = useState<{ id: number; title: string } | null>(null);

  const { data: quizzes } = useQuery({
    queryKey: ['admin-tools-quizzes'],
    queryFn: () => listQuizzes({ size: 50 }),
    enabled: kind === 'quiz',
  });
  const { data: decks } = useQuery({
    queryKey: ['admin-tools-decks'],
    queryFn: () => listSharedDecks({ size: 50 }),
    enabled: kind === 'decks',
  });
  const { data: gantts } = useQuery({
    queryKey: ['admin-tools-gantt'],
    queryFn: () => listSharedGanttCharts({ size: 50 }),
    enabled: kind === 'gantt',
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      if (kind === 'quiz') await deleteQuiz(id);
      else if (kind === 'decks') await deleteSharedDeck(id);
      else await deleteGanttChart(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tools-quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-tools-decks'] });
      queryClient.invalidateQueries({ queryKey: ['admin-tools-gantt'] });
    },
  });

  const rows: { id: number; title: string; meta: string; url?: string }[] =
    kind === 'quiz'
      ? (quizzes?.content ?? []).map((q) => ({
          id: q.id, title: q.title,
          meta: `${q.ownerName} · ${t('tools.quiz.questionsCount', { count: q.questionCount })} · ${formatDate(q.createdAt, i18n.language)}`,
        }))
      : kind === 'decks'
        ? (decks?.content ?? []).map((d) => ({
            id: d.id, title: d.title,
            meta: `${d.ownerName} · ${t('tools.flashcards.cardsCount', { count: d.cardCount })} · ${formatDate(d.createdAt, i18n.language)}`,
          }))
        : (gantts?.content ?? []).map((g) => ({
            id: g.id, title: g.title,
            meta: `${g.ownerName} · ${g.taskCount} · ${formatDate(g.updatedAt, i18n.language)}`,
          }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">{t('admin.toolsPanel.hint')}</Typography>
      <Tabs value={kind} onChange={(_, v) => setKind(v)}>
        <Tab value="quiz" label={t('admin.toolsPanel.quizzes')} />
        <Tab value="decks" label={t('admin.toolsPanel.decks')} />
        <Tab value="gantt" label={t('admin.toolsPanel.gantt')} />
      </Tabs>

      {rows.length === 0 && (
        <Typography color="text.secondary" sx={{ py: 2 }}>{t('admin.toolsPanel.empty')}</Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {rows.map((r) => (
          <GlassCard key={r.id} sx={{ p: 1.75, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 600 }} noWrap>{r.title}</Typography>
              <Typography variant="caption" color="text.secondary">{r.meta}</Typography>
            </Box>
            <Chip size="small" variant="outlined" label={`#${r.id}`} className="mono" />
            <Tooltip title={t('admin.toolsPanel.open')}>
              <IconButton size="small" component="a"
                href={kind === 'gantt' ? '/outils/gantt' : kind === 'decks' ? '/outils/flashcards' : '/outils/quiz'}
                target="_blank" aria-label={t('admin.toolsPanel.open')}>
                <OpenInNew fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('admin.toolsPanel.delete')}>
              <IconButton size="small" color="error" onClick={() => setCandidate({ id: r.id, title: r.title })}
                aria-label={t('admin.toolsPanel.delete')}>
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </GlassCard>
        ))}
      </Box>

      <ConfirmDialog
        open={candidate !== null}
        title={t('admin.toolsPanel.delete')}
        message={t('admin.toolsPanel.deleteConfirm', { name: candidate?.title ?? '' })}
        confirmLabel={t('common.confirm')}
        loading={deleteMut.isPending}
        onConfirm={() => {
          if (candidate) deleteMut.mutate(candidate.id);
          setCandidate(null);
        }}
        onClose={() => setCandidate(null)}
      />
    </Box>
  );
}
