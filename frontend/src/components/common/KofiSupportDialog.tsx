import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Skeleton,
} from '@mui/material';
import { ContentCopy, Check, Coffee, Login } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getMyKofiCode } from '@/api/endpoints';
import { KOFI_URL, DISCORD_OAUTH_URL } from '@/lib/constants';
import { useAuthStore } from '@/stores/useAuthStore';
import { useKofiDialogStore } from '@/stores/useKofiDialogStore';
import * as s from './KofiSupportDialog.styles';

/**
 * Dialog « Soutenir Freenote » monté UNE fois à la racine (App), ouvert par TOUT bouton Ko-fi.
 * Compte vérifié : montre le code personnel « FN-… » AVANT le départ vers Ko-fi — un don sans ce
 * code dans le message n'est pas rattaché au compte (avantages non appliqués). Anonyme / compte
 * non vérifié : invite à se connecter d'abord pour obtenir le code (demande 2026-07-09), avec un
 * « Faire un don quand même » — on ne bloque jamais un don, on prévient.
 */
export default function KofiSupportDialog() {
  const { t } = useTranslation();
  const open = useKofiDialogStore((st) => st.open);
  const close = useKofiDialogStore((st) => st.close);
  const token = useAuthStore((st) => st.token);
  const isVerified = useAuthStore((st) => st.isVerified);
  const [copied, setCopied] = useState(false);

  // Même queryKey que Profile/thermomètre : le code est immuable, une seule requête par session.
  const { data: kofiCode } = useQuery({
    queryKey: ['kofi-code'],
    queryFn: getMyKofiCode,
    staleTime: Infinity,
    enabled: open && isVerified,
  });

  const copyCode = async () => {
    if (!kofiCode) return;
    try {
      await navigator.clipboard.writeText(kofiCode.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers indisponible — le code reste sélectionnable à la main.
    }
  };

  const copyAndGo = async () => {
    if (kofiCode) {
      try {
        await navigator.clipboard.writeText(kofiCode.code);
      } catch {
        // Tant pis pour la copie — on ouvre quand même Ko-fi, le code reste visible dans le dialog.
      }
    }
    window.open(KOFI_URL, '_blank', 'noopener,noreferrer');
    close();
  };

  // Anonyme / compte non vérifié : pas de code possible → invite à se connecter d'abord,
  // avec la porte « donner quand même » (jamais de blocage d'un don).
  if (!isVerified) {
    return (
      <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
        <DialogTitle sx={s.title}>
          <Coffee fontSize="small" /> {t('kofiDialog.title')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('kofiDialog.loginLead')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={close}
            color="inherit"
            component="a"
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('kofiDialog.anyway')}
          </Button>
          {!token && (
            <Button variant="contained" startIcon={<Login />} component="a" href={DISCORD_OAUTH_URL}>
              {t('kofiDialog.login')}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
      <DialogTitle sx={s.title}>
        <Coffee fontSize="small" /> {t('kofiDialog.title')}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('kofiDialog.lead')}
        </Typography>

        <Box sx={s.codeBox}>
          {kofiCode ? (
            <Typography variant="h6" className="mono" sx={s.code}>
              {kofiCode.code}
            </Typography>
          ) : (
            <Skeleton variant="text" width={160} sx={{ fontSize: '1.25rem' }} />
          )}
          {/* span : un bouton disabled n'émet pas d'événements — sans wrapper, MUI Tooltip warn en console */}
          <Tooltip title={copied ? t('kofiDialog.copied') : t('kofiDialog.copy')}>
            <span>
              <IconButton size="small" onClick={copyCode} disabled={!kofiCode} aria-label={t('kofiDialog.copy')}>
                {copied ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          {t('kofiDialog.hint')}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          {t('kofiDialog.perks')}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close} color="inherit">
          {t('kofiDialog.later')}
        </Button>
        <Button variant="contained" startIcon={<Coffee />} onClick={copyAndGo}>
          {t('kofiDialog.cta')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
