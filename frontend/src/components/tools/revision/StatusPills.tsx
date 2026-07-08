import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { CloudOff, CloudDone, Public } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { ContentStatus } from './lib';

/**
 * Les 3 statuts d'un quiz/paquet, partagés entre les deux outils : 📱 « Cet appareil »
 * (localStorage seul), ☁️ « Enregistré » (copie serveur privée), 🌍 « Publié » (visible de
 * la promo). Un pill sur chaque carte + une légende au-dessus des listes — avant, chaque
 * outil avait sa propre chip et rien n'expliquait les états. Le calcul du statut
 * (statusOf) vit dans revision/lib (règle react-refresh : composants seuls ici).
 */

const META: Record<ContentStatus, { Icon: typeof CloudOff; color: 'warning' | 'info' | 'success' }> = {
  device: { Icon: CloudOff, color: 'warning' },
  saved: { Icon: CloudDone, color: 'info' },
  published: { Icon: Public, color: 'success' },
};

export function StatusPill({ status }: { status: ContentStatus }) {
  const { t } = useTranslation();
  const { Icon, color } = META[status];
  return (
    <Tooltip title={t(`tools.revision.statusHint.${status}`)}>
      <Chip
        size="small"
        color={color}
        variant="outlined"
        icon={<Icon sx={{ fontSize: 14 }} />}
        label={t(`tools.revision.status.${status}`)}
        sx={{ height: 20, flexShrink: 0 }}
      />
    </Tooltip>
  );
}

/** Légende compacte des trois statuts, affichée une fois au-dessus de la liste « Mes … ». */
export default function StatusLegend() {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1.5, rowGap: 0.5, mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary">{t('tools.revision.statusLegend')}</Typography>
      {(['device', 'saved', 'published'] as const).map((st) => (
        <Box key={st} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <StatusPill status={st} />
          <Typography variant="caption" color="text.secondary">
            = {t(`tools.revision.statusHint.${st}`)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
