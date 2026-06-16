import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
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
          <Route path="/browse" element={<ProtectedRoute><Browse /></ProtectedRoute>} />
          <Route path="/courses/:courseId" element={<ProtectedRoute><CoursePage /></ProtectedRoute>} />
          <Route path="/documents/:id" element={<ProtectedRoute><DocumentView /></ProtectedRoute>} />
          <Route path="/upload" element={<ProtectedRoute requireVerified><Upload /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/users/:id" element={<ProtectedRoute><UserPublic /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
          <Route path="/news" element={<News />} />
          <Route path="/news/:id" element={<NewsDetail />} />
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
