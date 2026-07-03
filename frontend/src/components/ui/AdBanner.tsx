import { useEffect, useRef } from 'react';
import { Box, Typography, Fade, Link as MuiLink } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';
import { KOFI_URL, ADSENSE_CLIENT, ADSENSE_SLOT } from '@/lib/constants';

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

interface AdBannerProps {
  width?: number;
  height?: number;
}

/**
 * Renders a real Google AdSense unit when a slot id is configured (VITE_ADSENSE_SLOT), else a styled
 * placeholder (dev/preview, or until the slot exists). Returns `null` for Ko-fi supporters so the
 * surrounding layout collapses instead of leaving a reserved empty slot. EEA consent is enforced by
 * Google's certified CMP (Consent Mode v2, loaded by adsbygoogle.js) — not by this component.
 */
export default function AdBanner({ width = 728, height = 90 }: AdBannerProps) {
  const { t } = useTranslation();
  const { user, token } = useAuthStore();

  if (user?.supporter) return null;

  if (ADSENSE_SLOT) return <AdsenseUnit width={width} height={height} />;

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

/**
 * One real AdSense display unit. The wrapping AdSlot already reserves `minHeight` so the push causes
 * no layout shift. The push is guarded against React Strict-Mode double-invoke; a failure (script
 * blocked / not ready) leaves the reserved space empty rather than throwing.
 * Responsive: `width` is a MAX width — on a 390 px phone the unit shrinks to the viewport instead of
 * overflowing (a fixed 728 px <ins> would force a horizontal scroll on mobile).
 */
function AdsenseUnit({ width, height }: { width: number; height: number }) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      /* AdSense not ready or blocked by an ad blocker — keep the empty reserved slot */
    }
  }, []);

  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block', width: '100%', maxWidth: width, height, marginLeft: 'auto', marginRight: 'auto' }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={ADSENSE_SLOT}
      data-full-width-responsive="true"
    />
  );
}
