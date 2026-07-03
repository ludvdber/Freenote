import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CardContent, Typography, Box, Chip, Rating, Tooltip, IconButton, Snackbar, Alert } from '@mui/material';
import { Visibility, Verified, SmartToy, PictureAsPdf, Share } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { DocumentResponse } from '@/types';
import GlassCard from '@/components/ui/GlassCard';
import { categoryColor, formatDate, shareOrCopy } from '@/lib/utils';
import * as s from './DocumentCard.styles';

interface Props {
  document: DocumentResponse;
  // 0 → no glow. 1 → maximum cyan halo. Use for popular/featured lists.
  haloStrength?: number;
}

export default function DocumentCard({ document: doc, haloStrength = 0 }: Props) {
  const { t, i18n } = useTranslation();
  const [shareStatus, setShareStatus] = useState<'copied' | 'shared' | null>(null);

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const result = await shareOrCopy({
      title: doc.title,
      text: doc.title,
      url: `${window.location.origin}/documents/${doc.id}`,
    });
    if (result !== 'error') setShareStatus(result);
  };

  return (
    <GlassCard component={Link} to={`/documents/${doc.id}`} sx={s.card(haloStrength)}>
      <CardContent sx={s.content}>
        <Box sx={s.headerRow}>
          <PictureAsPdf sx={s.pdfIcon} />
          <Box sx={s.headerText}>
            <Tooltip title={doc.title} enterDelay={400}>
              <Typography variant="subtitle2" sx={s.title} noWrap>
                {doc.title}
              </Typography>
            </Tooltip>
            <Typography variant="caption" color="text.secondary" noWrap>
              {doc.courseName} · {doc.authorName}
            </Typography>
          </Box>
        </Box>

        <Box sx={s.badgesRow}>
          <Chip
            label={t(`categories.${doc.category}`)}
            size="small"
            sx={s.categoryChip(categoryColor(doc.category))}
          />
          {doc.verified && (
            <Chip
              icon={<Verified sx={s.badgeIcon} />}
              label={t('document.verified')}
              size="small"
              color="primary"
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
        </Box>

        <Box sx={s.footerRow}>
          <Rating value={doc.averageRating ?? 0} precision={0.5} readOnly size="small" sx={s.ratingStyle} />
          <Box sx={s.downloadsRow}>
            <Visibility sx={s.downloadsIcon} />
            <Typography variant="caption" className="mono" color="text.secondary">
              {doc.downloadCount}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={s.createdAt}>
            {formatDate(doc.createdAt, i18n.language)}
          </Typography>
          <Tooltip title={t('common.share')} enterDelay={300}>
            <IconButton size="small" onClick={handleShare} sx={{ p: 0.5 }}>
              <Share sx={{ fontSize: 14, color: 'text.secondary' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </CardContent>
      <Snackbar open={shareStatus !== null} autoHideDuration={2000} onClose={() => setShareStatus(null)}>
        <Alert severity="success" onClose={() => setShareStatus(null)}>
          {shareStatus === 'shared' ? t('common.shared') : t('common.linkCopied')}
        </Alert>
      </Snackbar>
    </GlassCard>
  );
}
