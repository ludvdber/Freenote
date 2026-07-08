import { Box, Chip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import GlassCard from '@/components/ui/GlassCard';

/**
 * Tuile d'un quiz ou paquet publié — la brique du hub /reviser, réutilisée telle quelle
 * dans la section « révisions partagées » du profil public. Clic = ouvrir le bon outil
 * (`/outils/quiz#play=` / `/outils/flashcards#deck=`), la navigation reste à l'appelant.
 */
export default function RevisionTile({ type, title, unitCount, attemptCount = 0, ownerName, onClick }: {
  type: 'quiz' | 'deck';
  title: string;
  /** questions (quiz) ou cartes (paquet). */
  unitCount: number;
  /** parties jouées (quiz) — les paquets n'ont pas de compteur d'usage. */
  attemptCount?: number;
  /** Masqué sur le profil public (la page EST celle de l'auteur). */
  ownerName?: string;
  onClick: () => void;
}) {
  const { t } = useTranslation();

  return (
    <GlassCard
      onClick={onClick}
      sx={{
        p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 0.75, cursor: 'pointer',
        '&:hover .hub-cta': { textDecoration: 'underline' },
      }}
    >
      <Chip
        size="small"
        label={type === 'quiz' ? `❓ ${t('reviser.typeQuiz')}` : `🃏 ${t('reviser.typeDeck')}`}
        sx={{
          alignSelf: 'flex-start', height: 20, fontSize: 10, fontWeight: 800,
          letterSpacing: '0.05em', textTransform: 'uppercase',
          ...(type === 'quiz'
            ? { color: '#00d2ff', bgcolor: 'rgba(0,210,255,0.1)' }
            : { color: '#b18cff', bgcolor: 'rgba(177,140,255,0.12)' }),
        }}
      />
      <Typography sx={{ fontWeight: 800, lineHeight: 1.3 }}>{title}</Typography>
      <Typography variant="caption" color="text.secondary">
        {type === 'quiz'
          ? `${t('tools.quiz.questionsCount', { count: unitCount })}${attemptCount > 0 ? ` · ${t('tools.quiz.attemptsCount', { count: attemptCount })}` : ''}`
          : t('tools.flashcards.cardsCount', { count: unitCount })}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto', pt: 0.5 }}>
        <Typography variant="caption" color="text.secondary" noWrap>{ownerName ?? ''}</Typography>
        <Typography
          component="span"
          className="hub-cta"
          variant="caption"
          sx={{ fontWeight: 800, color: type === 'quiz' ? '#00d2ff' : '#b18cff', flexShrink: 0 }}
        >
          {type === 'quiz' ? `▶ ${t('reviser.play')}` : t('reviser.study')}
        </Typography>
      </Box>
    </GlassCard>
  );
}
