import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import * as s from './ToolsIndex.styles';

/**
 * Decorative, CSS-only mini-animations shown on the two flagship bento tiles
 * (Flashcards + Quiz). Purely illustrative → marked aria-hidden. Animations pause
 * under `prefers-reduced-motion` (handled in ToolsIndex.styles).
 */

export function FlashcardPreview() {
  const { t } = useTranslation();
  return (
    <Box sx={s.flipScene} aria-hidden="true">
      <Box sx={s.flipCard} className="tool-preview">
        <Box sx={s.flipFront}>
          {t('tools.previews.flashFront')}
          <Box component="span" sx={s.flipHint}>{t('tools.previews.flashHint')}</Box>
        </Box>
        <Box sx={s.flipBack}>{t('tools.previews.flashBack')}</Box>
      </Box>
    </Box>
  );
}

export function QuizPreview() {
  const { t } = useTranslation();
  return (
    <Box sx={s.quizPreview} aria-hidden="true" className="tool-preview">
      <Box sx={s.quizQuestion}>{t('tools.previews.quizQ')}</Box>
      <Box sx={s.quizOption(false)}>{t('tools.previews.quizA')}</Box>
      <Box sx={s.quizOption(true)}>{t('tools.previews.quizB')}</Box>
      <Box sx={s.quizOption(false)}>{t('tools.previews.quizC')}</Box>
    </Box>
  );
}
