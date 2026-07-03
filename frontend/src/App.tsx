import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useParams } from 'react-router-dom';
import { Box } from '@mui/material';
import { useAuthStore } from '@/stores/useAuthStore';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import AuthPromptSnackbar from '@/components/common/AuthPromptSnackbar';
import ScrollToTop from '@/components/common/ScrollToTop';
import TermsGate from '@/components/common/TermsGate';
import OnboardingGate from '@/components/common/OnboardingGate';
import OrbitalLoader from '@/components/ui/OrbitalLoader';
import { TOOLS } from '@/pages/tools/toolsData';

const Home = lazy(() => import('@/pages/Home'));
const Browse = lazy(() => import('@/pages/Browse'));
const CoursePage = lazy(() => import('@/pages/Course'));
const DocumentView = lazy(() => import('@/pages/DocumentView'));
const Upload = lazy(() => import('@/pages/Upload'));
const Profile = lazy(() => import('@/pages/Profile'));
const Leaderboard = lazy(() => import('@/pages/Leaderboard'));
const News = lazy(() => import('@/pages/News'));
const NewsDetail = lazy(() => import('@/pages/NewsDetail'));
const GuidesIndex = lazy(() => import('@/pages/GuidesIndex'));
const GuideDetail = lazy(() => import('@/pages/GuideDetail'));
const ResourceDetail = lazy(() => import('@/pages/ResourceDetail'));
const ToolsIndex = lazy(() => import('@/pages/tools/ToolsIndex'));
const ToolPage = lazy(() => import('@/pages/tools/ToolPage'));
const Admin = lazy(() => import('@/pages/Admin'));
const About = lazy(() => import('@/pages/About'));
const Legal = lazy(() => import('@/pages/Legal'));
const Privacy = lazy(() => import('@/pages/Privacy'));
const Terms = lazy(() => import('@/pages/Terms'));
const UserPublic = lazy(() => import('@/pages/UserPublic'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function Loading() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
      <OrbitalLoader size={56} />
    </Box>
  );
}

function MainLayout() {
  return (
    <>
      <Navbar />
      <Box component="main">
        <OnboardingGate>
          <TermsGate>
            <Suspense fallback={<Loading />}>
              <Outlet />
            </Suspense>
          </TermsGate>
        </OnboardingGate>
      </Box>
      <Footer />
    </>
  );
}

/** /documents/:id : le document complet (viewer PDF) pour un connecté, le teaser public
 *  (métadonnées + invite de connexion, ex-/ressources/:id) pour un anonyme. Même URL pour
 *  tous : partages et indexation Google pointent au même endroit. */
function DocumentRoute() {
  const token = useAuthStore((st) => st.token);
  return token ? <ProtectedRoute><DocumentView /></ProtectedRoute> : <ResourceDetail />;
}

/** Redirection paramétrée des anciennes URLs /ressources/:id (liens partagés, index Google). */
function LegacyResourceRedirect() {
  const { id } = useParams();
  return <Navigate to={`/documents/${id}`} replace />;
}

function ToolsLayout() {
  return (
    <>
      <Navbar />
      <Box component="main">
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </Box>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthPromptSnackbar />
      <Routes>
        {/* Tools — public, standalone layout (Navbar + Footer, no auth gate). One URL per tool for SEO. */}
        <Route element={<ToolsLayout />}>
          <Route path="/outils" element={<ToolsIndex />} />
          {TOOLS.map((tool) => (
            <Route key={tool.slug} path={`/outils/${tool.slug}`} element={<ToolPage tool={tool} />} />
          ))}
          {/* Legacy redirect — keep old shared links alive */}
          <Route path="/tools" element={<Navigate to="/outils" replace />} />
        </Route>

        {/* Main layout with Navbar + Footer */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          {/* Public : Browse gère lui-même les deux modes (catalogue complet / vitrine anonyme). */}
          <Route path="/browse" element={<Browse />} />
          <Route path="/courses/:courseId" element={<ProtectedRoute><CoursePage /></ProtectedRoute>} />
          <Route path="/documents/:id" element={<DocumentRoute />} />
          <Route path="/upload" element={<ProtectedRoute requireVerified><Upload /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/users/:id" element={<ProtectedRoute><UserPublic /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
          <Route path="/news" element={<News />} />
          <Route path="/news/:id" element={<NewsDetail />} />
          <Route path="/guides" element={<GuidesIndex />} />
          <Route path="/guides/:slug" element={<GuideDetail />} />
          {/* Anciennes URLs de la page « Ressources » (fusionnée dans /browse le 2026-07-03). */}
          <Route path="/ressources" element={<Navigate to="/browse" replace />} />
          <Route path="/ressources/:id" element={<LegacyResourceRedirect />} />
          <Route path="/a-propos" element={<About />} />
          <Route path="/about" element={<Navigate to="/a-propos" replace />} />
          <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
