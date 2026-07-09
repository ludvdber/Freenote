import { lazy, Suspense, useEffect } from 'react';
import { Container, Skeleton, Box } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAuthPromptStore } from '@/stores/useAuthPromptStore';
import HeroSection from '@/components/home/HeroSection';
import CountdownBanner from '@/components/home/CountdownBanner';
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
const FundingThermometer = lazy(() => import('@/components/home/FundingThermometer'));
const PopularDocs = lazy(() => import('@/components/home/PopularDocs'));
const PublicDocsPreview = lazy(() => import('@/components/home/PublicDocsPreview'));
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
        {/* Hiérarchie : PRODUIT (stats + docs/outils) → (comment ça marche, anon) → NEWS + liens → extras.
            Les outils vivent DANS l'aperçu (colonne droite anon) et dans l'accès rapide (connecté). */}

        {/* Compte à rebours (rentrée…) piloté par l'admin — rend null si non configuré/passé. */}
        <CountdownBanner />

        {/* Stats agrégées, visibles aussi des anonymes (GET /api/stats est permitAll). */}
        <Suspense fallback={<SectionFallback />}>
          <StatsSection />
        </Suspense>

        {/* Aperçu : docs populaires + classement (connecté), ou docs publics + outils (anonyme). */}
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

        {token && (
          <>
            <Divider />
            <Suspense fallback={<SectionFallback />}>
              <RecentAndShortcuts />
            </Suspense>
            <Divider />
            <Suspense fallback={<SectionFallback />}>
              <DelegatesDiscord />
            </Suspense>
          </>
        )}

        {/* Thermomètre « serveur du mois » (dons Ko-fi) — EN BAS de la page (demande 2026-07-09,
            « pas en plein milieu »), rend null si non configuré par l'admin. Il embarque son propre
            Divider pour ne pas laisser un séparateur orphelin. */}
        <Suspense fallback={null}>
          <FundingThermometer />
        </Suspense>

        {/* Pub en bas de page (au-dessus du footer), jamais collée au hero sans contenu autour. */}
        {!token && <AdSlot width={728} height={90} sx={{ mt: 6, mb: 4 }} />}
      </Container>
    </>
  );
}
