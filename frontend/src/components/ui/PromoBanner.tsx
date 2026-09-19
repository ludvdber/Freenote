import { Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ACCIO_URL } from '@/lib/constants';

interface PromoBannerProps {
  width: number;
  height: number;
}

// Charte officielle d'Accio Launcher (logo pack V2) — volontairement DIFFÉRENTE du violet/cyan de
// Freenote : une auto-promo doit se lire comme une annonce, pas comme un morceau de l'interface.
const GOLD = '#d6a72c';
const NIGHT = '#060611';
const SURFACE = '#0e1020';
const TEXT = '#f5f2ea';
const MUTED = '#9b98a6';

// Ambiance de l'écran de démarrage du launcher : halo bleu nuit + quelques étincelles dorées.
const BACKDROP = [
  `radial-gradient(1.5px 1.5px at 12% 22%, ${GOLD}aa, transparent)`,
  `radial-gradient(1px 1px at 38% 78%, ${GOLD}88, transparent)`,
  `radial-gradient(1.5px 1.5px at 67% 18%, ${GOLD}77, transparent)`,
  `radial-gradient(1px 1px at 88% 70%, ${GOLD}99, transparent)`,
  `radial-gradient(1px 1px at 53% 45%, #ffffff55, transparent)`,
  `radial-gradient(90% 120% at 30% 50%, #1a2040 0%, ${SURFACE} 45%, ${NIGHT} 100%)`,
].join(', ');

/** Trait doré terminé par une étincelle — le motif « Initialisation » du splash. */
function SparkLine({ sx }: { sx?: SxProps<Theme> }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        height: '1px',
        position: 'relative',
        background: `linear-gradient(90deg, ${GOLD}, ${GOLD}55 70%, transparent)`,
        '&::before': {
          content: '""',
          position: 'absolute',
          left: -2,
          top: -2,
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: '#fff3c4',
          boxShadow: `0 0 8px 2px ${GOLD}`,
        },
        ...sx,
      }}
    />
  );
}

const cta: SxProps<Theme> = {
  flexShrink: 0,
  px: 2,
  py: 0.75,
  borderRadius: 99,
  border: `1px solid ${GOLD}`,
  color: GOLD,
  fontWeight: 700,
  fontSize: 12.5,
  letterSpacing: '0.04em',
  transition: 'background .2s ease, color .2s ease',
};

/**
 * Auto-promo affichée dans les emplacements pub tant qu'aucune unité AdSense n'est configurée
 * (AdSense a refusé le site). Deux formats : leaderboard 728×90 et rectangle 300×250.
 * Lien `rel="sponsored"` : c'est une annonce, même maison — signal honnête pour les moteurs.
 */
export default function PromoBanner({ width, height }: PromoBannerProps) {
  const { t } = useTranslation();
  const box = height >= 200;

  return (
    <Box
      component="a"
      href={ACCIO_URL}
      target="_blank"
      rel="sponsored noopener"
      aria-label={`${t('ad.promo.title')} — ${t('ad.promo.tagline')}`}
      sx={{
        width: { xs: '100%', md: width },
        maxWidth: '100%',
        height,
        mx: 'auto',
        display: 'flex',
        flexDirection: box ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: box ? 1.5 : { xs: 1.5, sm: 2.5 },
        px: box ? 3 : { xs: 1.5, sm: 2.5 },
        textAlign: box ? 'center' : 'left',
        borderRadius: 2,
        overflow: 'hidden',
        textDecoration: 'none',
        color: TEXT,
        background: BACKDROP,
        border: `1px solid ${GOLD}40`,
        transition: 'transform .2s ease, border-color .2s ease, box-shadow .2s ease',
        '&:hover, &:focus-visible': {
          transform: 'translateY(-2px)',
          borderColor: `${GOLD}aa`,
          boxShadow: `0 8px 28px ${GOLD}26`,
        },
        '&:hover .promo-cta, &:focus-visible .promo-cta': { background: GOLD, color: NIGHT },
      }}
    >
      <Box
        component="img"
        src="/promo/accio-logo.svg"
        alt=""
        aria-hidden="true"
        sx={box
          ? { width: 230, height: 'auto' }
          : { height: { xs: 50, sm: 64 }, width: 'auto', flexShrink: 0, ml: -1 }}
      />

      {box ? (
        <>
          <SparkLine sx={{ width: '70%', mt: -0.5 }} />
          <Typography sx={{ fontSize: 14.5, lineHeight: 1.35, fontWeight: 600, px: 1 }}>
            {t('ad.promo.tagline')}
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: MUTED, mt: -0.75 }}>
            {t('ad.promo.points')}
          </Typography>
          <Box className="promo-cta" sx={cta}>{t('ad.promo.cta')} →</Box>
        </>
      ) : (
        <>
          <Box
            aria-hidden="true"
            sx={{ width: '1px', alignSelf: 'stretch', my: 2, background: `${GOLD}44`, display: { xs: 'none', sm: 'block' } }}
          />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              sx={{
                fontSize: { xs: 12.5, sm: 14.5 },
                fontWeight: 600,
                lineHeight: 1.3,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {t('ad.promo.tagline')}
            </Typography>
            <Typography sx={{ fontSize: 11.5, color: MUTED, mt: 0.25, display: { xs: 'none', md: 'block' } }}>
              {t('ad.promo.points')}
            </Typography>
          </Box>
          <Box className="promo-cta" sx={{ ...cta, display: { xs: 'none', sm: 'block' } }}>
            {t('ad.promo.cta')} →
          </Box>
        </>
      )}
    </Box>
  );
}
