import { lazy, Suspense, useEffect } from 'react';
import { Container, Skeleton, Box } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAuthPromptStore } from '@/stores/useAuthPromptStore';
import HeroSection from '@/components/home/HeroSection';
import Divider from '@/components/ui/Divider';
import AdSlot from '@/components/ui/AdSlot';

// Maps the ?authError=<code> set by OAuth2LoginFailureHandler to an i18n key.
const AUTH_ERROR_KEYS: Record<string, string> = {
  banned: 'auth.oauthBanned',
  unverified_email: 'auth.oauthUnverifiedEmail',
  oauth_failed: 'auth.oauthFailed',
};

const StatsSection = lazy(() => import('@/components/home/StatsSection'));
const NewsAndLinks = lazy(() => import('@/components/home/NewsAndLinks'));
const PopularDocs = lazy(() => import('@/components/home/PopularDocs'));
const PublicDocsPreview = lazy(() => import('@/components/home/PublicDocsPreview'));
const HomeToolsStrip = lazy(() => import('@/components/home/HomeToolsStrip'));
const HowItWorks = lazy(() => import('@/components/home/HowItWorks'));
const RecentAndShortcuts = lazy(() => import('@/components/home/RecentAndShortcuts'));
const DelegatesDiscord = lazy(() => import('@/components/home/DelegatesDiscord'));

function SectionFallback() {
  return (
    <Box sx={{ py: 4 }}>
      <Skeleton variant="rounded" height={140} sx={{ borderRadius: 3, bgcolor: 'rgba(255,255,255,0.04)' }} />
    </Box>
  );
}

export default function Home() {
  const { token } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const showPrompt = useAuthPromptStore((s) => s.show);

  // The "please log in" snackbar is now global — rendered by <AuthPromptSnackbar/>
  // at the App root, fired either by NAV link clicks (no URL flash) or by
  // <ProtectedRoute> on direct URL entry (fallback).

  // A failed OAuth login (banned Discord, unverified provider email) redirects here with
  // ?authError=<code>. Surface it via the global snackbar, then strip the param so a refresh
  // doesn't re-show it.
  useEffect(() => {
    const code = searchParams.get('authError');
    if (!code) return;
    showPrompt(AUTH_ERROR_KEYS[code] ?? 'auth.oauthFailed');
    searchParams.delete('authError');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, showPrompt]);

  return (
    <>
      <Helmet><title>Freenote : éclaire ta promo</title></Helmet>
      <HeroSection />
      <Container maxWidth="lg">
        {/* Hiérarchie : PRODUIT (stats + docs) → (comment ça marche, anon) → NEWS + liens.
            Le produit passe avant le contenu tiers ; les outils (bande pleine largeur, plus bas)
            descendent sous « Quoi de neuf » + les liens utiles et ne sont plus collés au catalogue. */}

        {/* Stats agrégées, visibles aussi des anonymes (GET /api/stats est permitAll). */}
        <Suspense fallback={<SectionFallback />}>
          <StatsSection />
        </Suspense>

        {/* Aperçu du catalogue : docs réels (populaires) pour les connectés, extrait public anonymisé
            (catégories sûres, sans auteur ni PDF) pour les anonymes. */}
        <Divider />
        <Suspense fallback={<SectionFallback />}>
          {token ? <PopularDocs /> : <PublicDocsPreview />}
        </Suspense>

        {/* Onboarding explicite pour les visiteurs anonymes. */}
        {!token && (
          <>
            <Divider />
            <Suspense fallback={<SectionFallback />}>
              <HowItWorks />
            </Suspense>
          </>
        )}

        {/* News de l'école (contenu tiers) + liens utiles. */}
        <Divider />
        <Suspense fallback={<SectionFallback />}>
          <NewsAndLinks />
        </Suspense>
      </Container>

      {/* Outils — bande PLEINE LARGEUR légèrement teintée : casse le rythme des cartes en verre et
          lit « zone d'apps » plutôt que « encore des cartes ». Hors Container pour le fond full-bleed,
          avec un Container interne qui re-contraint le contenu. */}
      <Box
        component="section"
        sx={{
          mt: 6,
          py: { xs: 4, md: 6 },
          borderTop: '1px solid',
          borderBottom: '1px solid',
          borderColor: 'divider',
          background: (th) =>
            th.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(123,47,247,0.07), rgba(0,210,255,0.05))'
              : 'linear-gradient(180deg, rgba(123,47,247,0.04), rgba(0,210,255,0.04))',
        }}
      >
        <Container maxWidth="lg">
          <Suspense fallback={<SectionFallback />}>
            <HomeToolsStrip />
          </Suspense>
        </Container>
      </Box>

      <Container maxWidth="lg">
        {token && (
          <>
            <Suspense fallback={<SectionFallback />}>
              <RecentAndShortcuts />
            </Suspense>
            <Divider />
            <Suspense fallback={<SectionFallback />}>
              <DelegatesDiscord />
            </Suspense>
          </>
        )}

        {/* Pub en bas de page (au-dessus du footer), jamais collée au hero sans contenu autour. */}
        {!token && <AdSlot width={728} height={90} sx={{ mt: 6, mb: 4 }} />}
      </Container>
    </>
  );
}
