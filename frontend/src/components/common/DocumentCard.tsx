import { Link } from 'react-router-dom';
import { CardContent, Typography, Box, Chip, Tooltip, useTheme } from '@mui/material';
import { Visibility, SmartToy, HourglassEmpty, Star } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { DocumentResponse } from '@/types';
import GlassCard from '@/components/ui/GlassCard';
import UserAvatar from '@/components/common/UserAvatar';
import { categoryColor, formatRelativeDate, isNewDoc, isHotDoc } from '@/lib/utils';
import * as s from './DocumentCard.styles';

interface Props {
  document: DocumentResponse;
  // 0 → no glow. 1 → maximum cyan halo. Use for popular/featured lists.
  haloStrength?: number;
  /** 'card' = tuile de grille (défaut) ; 'row' = ligne compacte pour la vue liste de l'explorer. */
  variant?: 'card' | 'row';
}

export default function DocumentCard({ document: doc, haloStrength = 0, variant = 'card' }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();

  const color = categoryColor(doc.category, theme.palette.mode);
  // UN seul badge de fraîcheur calculé — « Nouveau » prime sur « 🔥 », jamais les deux (bruit).
  const isNew = isNewDoc(doc.createdAt);
  const isHot = !isNew && isHotDoc(doc.createdAt, doc.downloadCount);
  const courseLine = [doc.courseName, doc.sectionName].filter(Boolean).join(' · ');

  // Blocs partagés entre les deux variantes.
  const freshness = (
    <>
      {isNew && <Chip label={t('document.badgeNew')} size="small" color="primary" sx={s.freshnessChip} />}
      {isHot && (
        <Tooltip title={t('document.badgeHot')} enterDelay={300}>
          <Chip label="🔥" size="small" aria-label={t('document.badgeHot')} sx={s.freshnessChip} />
        </Tooltip>
      )}
    </>
  );

  // Titre EN PREMIER — c'est lui qu'on scanne, pas l'année ni la catégorie.
  const titleRow = (
    <Box sx={s.titleRow}>
      <Tooltip title={doc.title} enterDelay={400}>
        <Typography variant="subtitle2" sx={s.title} noWrap>
          {doc.title}
        </Typography>
      </Tooltip>
      {freshness}
    </Box>
  );

  // Ligne « contexte » sous le titre : catégorie + cours · section, année reléguée en bout de ligne.
  const metaLine = (
    <Box sx={s.metaLine}>
      <Chip label={t(`categories.${doc.category}`)} size="small" sx={s.categoryChip(color)} />
      <Typography variant="caption" color="text.secondary" noWrap sx={s.courseLine}>
        {courseLine}
      </Typography>
      {doc.year && (
        <Typography variant="caption" color="text.secondary" className="mono" sx={s.yearCaption}>
          {doc.year}
        </Typography>
      )}
    </Box>
  );

  // États rares : plus AUCUN badge sur un doc vérifié sans particularité (c'était du bruit
  // sur ~90 % des cartes) — seuls les docs en attente de relecture ou IA sont signalés.
  const stateChips = (!doc.verified || doc.aiGenerated) ? (
    <>
      {!doc.verified && (
        <Chip
          icon={<HourglassEmpty sx={s.badgeIcon} />}
          label={t('document.pending')}
          size="small"
          color="warning"
          variant="outlined"
          sx={s.badgeChip}
        />
      )}
      {doc.aiGenerated && (
        <Chip
          icon={<SmartToy sx={s.badgeIcon} />}
          label={t('document.aiShort')}
          size="small"
          color="warning"
          variant="outlined"
          sx={s.badgeChip}
        />
      )}
    </>
  ) : null;

  // Note UNIQUEMENT quand il y a des votes — des étoiles vides se lisaient comme « note 0 ».
  const rating = doc.ratingCount > 0 && (
    <Box sx={s.ratingBox}>
      <Star sx={s.ratingIcon} />
      <Typography variant="caption" className="mono" sx={{ fontWeight: 700 }}>
        {doc.averageRating.toFixed(1)}
      </Typography>
      <Typography variant="caption" className="mono" sx={s.ratingCountCaption}>
        ({doc.ratingCount})
      </Typography>
    </Box>
  );

  const views = (
    <Box sx={s.viewsBox}>
      <Visibility sx={s.downloadsIcon} />
      <Typography variant="caption" className="mono" color="text.secondary">
        {doc.downloadCount}
      </Typography>
    </Box>
  );

  const author = (
    <Box sx={s.authorRow}>
      <UserAvatar username={doc.authorName} url={doc.authorAvatarUrl} size={20} />
      <Typography variant="caption" color="text.secondary" noWrap sx={s.authorName}>
        {doc.authorName}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={s.relativeDate}>
        · {formatRelativeDate(doc.createdAt, i18n.language)}
      </Typography>
    </Box>
  );

  if (variant === 'row') {
    return (
      <GlassCard component={Link} to={`/documents/${doc.id}`} sx={s.rowCard(color)}>
        <Box sx={s.rowMain}>
          <Box sx={s.titleRow}>
            <Tooltip title={doc.title} enterDelay={400}>
              <Typography variant="subtitle2" sx={s.title} noWrap>
                {doc.title}
              </Typography>
            </Tooltip>
            {freshness}
            {stateChips}
          </Box>
          {metaLine}
        </Box>
        <Box sx={s.rowStats}>
          {rating}
          {views}
          <Box sx={s.rowAuthor}>{author}</Box>
        </Box>
      </GlassCard>
    );
  }

  return (
    <GlassCard component={Link} to={`/documents/${doc.id}`} sx={s.card(haloStrength, color)}>
      <CardContent sx={s.content}>
        {titleRow}
        {metaLine}
        {stateChips && <Box sx={s.stateRow}>{stateChips}</Box>}
        <Box sx={s.footerRow}>
          {author}
          <Box sx={s.metaRow}>
            {rating}
            {views}
          </Box>
        </Box>
      </CardContent>
    </GlassCard>
  );
}
