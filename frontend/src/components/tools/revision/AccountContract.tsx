import { Box, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { DISCORD_OAUTH_URL } from '@/lib/constants';

/**
 * Le « contrat » anonyme des outils d'étude, en deux colonnes : ce qui marche sans compte
 * (créer/réviser en local, liens partagés) vs ce que le compte vérifié ajoute (bibliothèque,
 * classement, multi-appareils). Remplace l'ancien petit hint ambigu — un déconnecté doit
 * comprendre d'un coup d'œil pourquoi Jouer marche mais pas la Bibliothèque.
 */
export default function AccountContract({ free, locked }: { free: string[]; locked: string[] }) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        border: '1px solid rgba(255,255,255,0.1)',
        borderColor: (th) => (th.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'),
        borderRadius: 3,
        overflow: 'hidden',
        mb: 3,
      }}
    >
      <Box sx={{ p: 2.5, bgcolor: 'rgba(0,210,255,0.05)' }}>
        <Typography sx={overlineSx('#00d2ff')}>✓ {t('tools.revision.freeTitle')}</Typography>
        {free.map((line) => (
          <Typography key={line} variant="body2" sx={{ py: 0.4 }}>{line}</Typography>
        ))}
      </Box>
      <Box
        sx={{
          p: 2.5,
          bgcolor: (th) => (th.palette.mode === 'dark' ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.03)'),
          borderLeft: { sm: '1px solid' },
          borderTop: { xs: '1px solid', sm: 'none' },
          borderColor: { xs: 'divider', sm: 'divider' },
        }}
      >
        <Typography sx={overlineSx()}>🔒 {t('tools.revision.lockedTitle')}</Typography>
        {locked.map((line) => (
          <Typography key={line} variant="body2" color="text.secondary" sx={{ py: 0.4 }}>{line}</Typography>
        ))}
        <Button href={DISCORD_OAUTH_URL} variant="contained" size="small" sx={{ mt: 1.5 }}>
          {t('resources.loginCta')}
        </Button>
      </Box>
    </Box>
  );
}

const overlineSx = (color?: string) => ({
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: 11,
  letterSpacing: 1.5,
  textTransform: 'uppercase' as const,
  color: color ?? 'text.secondary',
  mb: 1,
});
