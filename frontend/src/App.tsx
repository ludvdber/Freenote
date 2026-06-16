import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import AuthPromptSnackbar from '@/components/common/AuthPromptSnackbar';
import ScrollToTop from '@/components/common/ScrollToTop';
import TermsGate from '@/components/common/TermsGate';
import OnboardingGate from '@/components/common/OnboardingGate';
import OrbitalLoader from '@/components/ui/OrbitalLoader';

const Home = lazy(() => import('@/pages/Home'));
const Browse = lazy(() => import('@/pages/Browse'));
const CoursePage = lazy(() => import('@/pages/Course'));
const DocumentView = lazy(() => import('@/pages/DocumentView'));
const Upload = lazy(() => import('@/pages/Upload'));
const Profile = lazy(() => import('@/pages/Profile'));
const Leaderboard = lazy(() => import('@/pages/Leaderboard'));
const News = lazy(() => import('@/pages/News'));
const NewsDetail = lazy(() => import('@/pages/NewsDetail'));
const Tools = lazy(() => import('@/pages/Tools'));
const Admin = lazy(() => import('@/pages/Admin'));
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
    <Box component="main">
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </Box>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthPromptSnackbar />
      <Routes>
        {/* Tools route without main layout */}
        <Route element={<ToolsLayout />}>
          <Route path="/tools" element={<Tools />} />
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
