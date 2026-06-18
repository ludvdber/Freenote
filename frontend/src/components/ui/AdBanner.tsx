import { Box, Typography, Fade, Link as MuiLink } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';
import { KOFI_URL } from '@/lib/constants';

interface AdBannerProps {
  width?: number;
  height?: number;
}

/**
 * Returns the placeholder when an ad should be shown, or `null` for Ko-fi supporters
 * (so the surrounding layout collapses instead of leaving a reserved empty slot).
 * Anonymous visitors see the ad — tracking is still gated by cookie consent at the slot level.
 */
export default function AdBanner({ width = 728, height = 90 }: AdBannerProps) {
  const { t } = useTranslation();
  const { user, token } = useAuthStore();

  if (user?.supporter) return null;

  return (
    <Fade in timeout={600}>
      <Box sx={{ textAlign: 'center' }}>
        <Box
          sx={{
            width: { xs: '100%', md: width },
            height,
            mx: 'auto',
            borderRadius: 2,
            background: (th) => th.palette.mode === 'dark'
              ? 'rgba(123, 47, 247, 0.08)'
              : 'rgba(123, 47, 247, 0.05)',
            border: (th) => `1px dashed ${th.palette.mode === 'dark' ? 'rgba(123, 47, 247, 0.25)' : 'rgba(123, 47, 247, 0.2)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.6 }}>
            Ad {width}x{height}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', opacity: 0.5, fontSize: 10 }}>
          {t('ad.disclaimer')}{' '}
          <MuiLink
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ fontSize: 'inherit', opacity: 1 }}
          >
            Ko-fi ☕
          </MuiLink>
          {!token && (
            <>
              {' · '}
              {t('ad.loginHint')}
            </>
          )}
        </Typography>
      </Box>
    </Fade>
  );
}
