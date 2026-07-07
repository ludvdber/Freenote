import { lazy, Suspense, useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, Container, useMediaQuery } from '@mui/material';
import { Explore, CloudUpload, KeyboardArrowDown } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useThemeStore } from '@/stores/useThemeStore';
import { useAuthStore } from '@/stores/useAuthStore';
import DiscordIcon from '@/components/icons/DiscordIcon';
import { DISCORD_OAUTH_URL } from '@/lib/constants';
// OrbsFallback is a pure-CSS component (no Three.js import), so referencing it here does NOT pull
// the heavy @react-three/fiber + three bundle into the entry chunk.
import OrbsFallback from '@/components/three/ParticleField/OrbsFallback';

const HeroBackground = lazy(() => import('@/components/three/ParticleField'));
import * as s from './HeroSection.styles';

export default function HeroSection() {
  const { t } = useTranslation();
  const { token } = useAuthStore();
  const theme = useThemeStore((st) => st.theme);
  const [showBackground, setShowBackground] = useState(false);
  // noSsr so the first render already reflects the real viewport — on mobile we must NOT even
  // mount <HeroBackground/>, otherwise React.lazy would fetch the ~230 KB gz Three.js chunk that
  // mobile never uses (it only renders the CSS orbs). This is the PageSpeed mobile P1 fix.
  const isMobile = useMediaQuery('(max-width: 768px)', { noSsr: true });

  // Defer the heavy Three.js background (≈230 KB gz) until the browser is idle, so it never
  // competes with hydration / LCP on first load. It fades in anyway, so the short delay is
  // invisible; the base gradient stands in for the few ms before it mounts. Desktop only.
  useEffect(() => {
    if (isMobile) return;
    const ric = window.requestIdleCallback;
    if (ric) {
      const id = ric(() => setShowBackground(true), { timeout: 2000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setShowBackground(true), 300);
    return () => window.clearTimeout(id);
  }, [isMobile]);

  const handleScrollDown = useCallback(() => {
    const hero = document.getElementById('hero-section');
    if (hero) {
      const next = hero.nextElementSibling;
      if (next) {
        next.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
  }, []);

  // NB : plus de wheel-jacking ici (l'ancien listener `wheel` passive:false + preventDefault
  // détournait le premier coup de molette — déroutant au trackpad et coûteux en main-thread).
  // Le scroll est laissé au navigateur ; l'ancre cliquable ci-dessous suffit.

  return (
    <motion.section initial="hidden" animate="show" variants={s.staggerVariants}>
      <Box id="hero-section" sx={s.heroContainer}>
        {/* Mobile renders the cheap CSS orbs directly — never importing Three.js. Desktop lazy-loads
            the particle field once the browser is idle. */}
        {isMobile ? (
          <OrbsFallback theme={theme} />
        ) : (
          showBackground && (
            <Suspense fallback={null}>
              <HeroBackground theme={theme} />
            </Suspense>
          )
        )}
        {/* Deux nébuleuses CSS supplémentaires derrière le titre — densifient la scène pour un
            coût nul (le fond était à 60 % de noir vide en dark). */}
        <Box aria-hidden="true" sx={s.nebulaA} />
        <Box aria-hidden="true" sx={s.nebulaB} />
        <Container maxWidth="md" sx={s.inner}>
          <motion.div variants={s.titleVariants}>
            <Typography variant="h1" sx={s.title}>
              {t('hero.title')}
              <Box component="br" />
              <Box component="span" sx={s.titleGradient}>
                {t('hero.titleHighlight')}
              </Box>
            </Typography>
          </motion.div>

          <motion.div variants={s.fadeUpVariants}>
            <Typography variant="h6" component="p" color="text.secondary" sx={s.subtitle}>
              {t('hero.subtitle')}
            </Typography>
          </motion.div>

          {/* Le chip ISFCE entre le sous-titre et les CTA (choix produit 2026-07-07) :
              il qualifie l'audience juste avant l'action, sans concurrencer le titre. */}
          <motion.div variants={s.fadeUpVariants}>
            <Typography variant="body2" sx={s.restrictedBadge}>
              {t('hero.restricted')}
            </Typography>
          </motion.div>

          <motion.div variants={s.fadeUpVariants}>
            <Box sx={s.ctaRow}>
              <Button
                variant="contained"
                size="large"
                component={Link}
                to="/browse"
                startIcon={<Explore />}
                sx={s.ctaPrimary}
              >
                {t('hero.cta')}
              </Button>
              {/* Déconnecté : « Partager un doc » n'a pas de sens (upload exige un compte vérifié) —
                  le second CTA devient directement le login Discord. */}
              {token ? (
                <Button
                  variant="outlined"
                  size="large"
                  component={Link}
                  to="/upload"
                  startIcon={<CloudUpload />}
                  sx={s.ctaSecondary}
                >
                  {t('hero.ctaSecondary')}
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  size="large"
                  component="a"
                  href={DISCORD_OAUTH_URL}
                  startIcon={<DiscordIcon />}
                  sx={s.ctaSecondary}
                >
                  {t('hero.ctaLogin')}
                </Button>
              )}
            </Box>
          </motion.div>
        </Container>

        <Box
          component="button"
          type="button"
          onClick={handleScrollDown}
          aria-label={t('hero.scrollDown')}
          sx={s.scrollIndicator}
        >
          <Typography component="span" sx={s.scrollIndicatorLabel}>
            {t('hero.scrollDown')}
          </Typography>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ display: 'flex' }}
          >
            <KeyboardArrowDown fontSize="medium" />
          </motion.div>
        </Box>
      </Box>
    </motion.section>
  );
}
