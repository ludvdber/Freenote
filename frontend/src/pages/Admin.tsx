import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Typography, Box, Select, MenuItem, ListSubheader } from '@mui/material';
import {
  SpaceDashboard,
  Insights,
  Description,
  Flag,
  DifferenceOutlined,
  Quiz as QuizIcon,
  MenuBook,
  Construction,
  AccountTree,
  Class as ClassIcon,
  School,
  HowToVote,
  Group,
  Favorite,
  ReceiptLong,
  Settings,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { getAdminOverview, getModerationQueue } from '@/api/endpoints';
import type { ModerationQueue } from '@/types';
import { useAuthStore } from '@/stores/useAuthStore';
import PageWrapper from '@/components/layout/PageWrapper';
import GlassCard from '@/components/ui/GlassCard';
import OrbitalLoader from '@/components/ui/OrbitalLoader';
import * as s from './Admin.styles';

const AdminOverview = lazy(() => import('@/components/admin/AdminOverview'));
const AdminAnalytics = lazy(() => import('@/components/admin/AdminAnalytics'));
const AdminDocuments = lazy(() => import('@/components/admin/AdminDocuments'));
const AdminDuplicates = lazy(() => import('@/components/admin/AdminDuplicates'));
const AdminSections = lazy(() => import('@/components/admin/AdminSections'));
const AdminCourses = lazy(() => import('@/components/admin/AdminCourses'));
const AdminProfessors = lazy(() => import('@/components/admin/AdminProfessors'));
const AdminReports = lazy(() => import('@/components/admin/AdminReports'));
const AdminDelegates = lazy(() => import('@/components/admin/AdminDelegates'));
const AdminUsers = lazy(() => import('@/components/admin/AdminUsers'));
const AdminDonations = lazy(() => import('@/components/admin/AdminDonations'));
const AdminActivityLogs = lazy(() => import('@/components/admin/AdminActivityLogs'));
const AdminGuides = lazy(() => import('@/components/admin/AdminGuides'));
const AdminRevision = lazy(() => import('@/components/admin/AdminRevision'));
const AdminTools = lazy(() => import('@/components/admin/AdminTools'));
const AdminSettings = lazy(() => import('@/components/admin/AdminSettings'));

export type AdminPane =
  | 'overview' | 'analytics'
  | 'documents' | 'reports' | 'duplicates' | 'revision'
  | 'guides' | 'tools'
  | 'sections' | 'courses' | 'professors' | 'delegates'
  | 'users' | 'donations'
  | 'logs' | 'settings';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PANES: Record<AdminPane, ComponentType<any>> = {
  overview: AdminOverview,
  analytics: AdminAnalytics,
  documents: AdminDocuments,
  reports: AdminReports,
  duplicates: AdminDuplicates,
  revision: AdminRevision,
  guides: AdminGuides,
  tools: AdminTools,
  sections: AdminSections,
  courses: AdminCourses,
  professors: AdminProfessors,
  delegates: AdminDelegates,
  users: AdminUsers,
  donations: AdminDonations,
  logs: AdminActivityLogs,
  settings: AdminSettings,
};

/** Qui voit quoi (V18) : 'admin' = admin seul ; 'moderator' / 'editor' = admin OU ce rôle. */
type PaneAccess = 'admin' | 'moderator' | 'editor';

interface NavItem {
  id: AdminPane;
  icon: ReactNode;
  access?: PaneAccess; // défaut : celui du groupe
  badge?: (o: ModerationQueue) => number;
}

/** Groupes = périmètres de rôles : un Modérateur ne voit que « Modération », un Rédacteur que
 *  « Contenu → Guides » — l'accès réel est re-vérifié serveur (matchers + filtre live en DB). */
const GROUPS: { labelKey: string | null; access: PaneAccess; items: NavItem[] }[] = [
  {
    labelKey: null,
    access: 'admin',
    items: [
      { id: 'overview', icon: <SpaceDashboard /> },
      { id: 'analytics', icon: <Insights /> },
    ],
  },
  {
    labelKey: 'admin.nav.moderation',
    access: 'moderator',
    items: [
      { id: 'documents', icon: <Description />, badge: (o) => o.pendingDocs },
      { id: 'reports', icon: <Flag />, badge: (o) => o.pendingReports },
      { id: 'duplicates', icon: <DifferenceOutlined />, badge: (o) => o.duplicateGroups },
      { id: 'revision', icon: <QuizIcon /> },
    ],
  },
  {
    labelKey: 'admin.nav.content',
    access: 'admin',
    items: [
      { id: 'guides', icon: <MenuBook />, access: 'editor' },
      { id: 'tools', icon: <Construction /> },
    ],
  },
  {
    labelKey: 'admin.nav.catalogue',
    access: 'admin',
    items: [
      { id: 'sections', icon: <AccountTree /> },
      { id: 'courses', icon: <ClassIcon /> },
      { id: 'professors', icon: <School /> },
      { id: 'delegates', icon: <HowToVote /> },
    ],
  },
  {
    labelKey: 'admin.nav.community',
    access: 'admin',
    items: [
      { id: 'users', icon: <Group /> },
      { id: 'donations', icon: <Favorite /> },
    ],
  },
  {
    labelKey: 'admin.nav.system',
    access: 'admin',
    items: [
      { id: 'logs', icon: <ReceiptLong /> },
      { id: 'settings', icon: <Settings /> },
    ],
  },
];

function PaneFallback() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
      <OrbitalLoader size={40} />
    </Box>
  );
}

export default function Admin() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdmin } = useAuthStore();
  const canModerate = isAdmin || !!user?.moderator;
  const canEdit = isAdmin || !!user?.editor;

  const allowed = (access: PaneAccess) =>
    access === 'admin' ? isAdmin : access === 'moderator' ? canModerate : canEdit;
  const groups = GROUPS
    .map((g) => ({ ...g, items: g.items.filter((it) => allowed(it.access ?? g.access)) }))
    .filter((g) => g.items.length > 0);

  // Le pane vit dans l'URL (?pane=…) : deep-links, back/forward et F5 conservent l'écran ouvert.
  // L'atterrissage suit le rôle : admin → vue d'ensemble, modérateur → documents, rédacteur → guides.
  const home: AdminPane = isAdmin ? 'overview' : canModerate ? 'documents' : 'guides';
  const allowedPanes = new Set(groups.flatMap((g) => g.items.map((it) => it.id)));
  const raw = searchParams.get('pane') ?? home;
  const pane: AdminPane = allowedPanes.has(raw as AdminPane) ? (raw as AdminPane) : home;
  const setPane = (next: AdminPane) => {
    const params = new URLSearchParams(searchParams);
    if (next === home) params.delete('pane');
    else params.set('pane', next);
    setSearchParams(params, { replace: false });
  };

  // Badges de file d'attente — rafraîchis en continu pour que la sidebar dise toujours vrai.
  // Même queryKey pour les deux rôles (les mutations modération l'invalident) ; un modérateur
  // n'a pas accès à la vue d'ensemble complète → endpoint réduit /moderation/queue. Un rédacteur
  // seul n'a pas de badges du tout (enabled).
  const { data: overview } = useQuery<ModerationQueue>({
    queryKey: ['admin-overview'],
    queryFn: isAdmin ? getAdminOverview : getModerationQueue,
    refetchInterval: 60_000,
    enabled: canModerate,
  });

  const Panel = PANES[pane];

  return (
    <PageWrapper maxWidth="xl">
      <Helmet><title>{t('nav.admin')} · Freenote</title></Helmet>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>{t('nav.admin')}</Typography>

      {/* Mobile : la sidebar devient un Select groupé (avec les compteurs dans les libellés). */}
      <Box sx={s.mobileNav}>
        <Select fullWidth size="small" value={pane} onChange={(e) => setPane(e.target.value as AdminPane)}>
          {groups.flatMap((group) => [
            ...(group.labelKey ? [<ListSubheader key={group.labelKey}>{t(group.labelKey)}</ListSubheader>] : []),
            ...group.items.map((item) => {
              const count = overview && item.badge ? item.badge(overview) : 0;
              return (
                <MenuItem key={item.id} value={item.id}>
                  {t(`admin.tabs.${item.id}`)}{count > 0 ? ` (${count})` : ''}
                </MenuItem>
              );
            }),
          ])}
        </Select>
      </Box>

      <Box sx={s.layout}>
        <GlassCard sx={s.side} component="nav" aria-label={t('nav.admin')}>
          {groups.map((group, gi) => (
            <Box key={group.labelKey ?? gi}>
              {group.labelKey && (
                <Typography sx={s.groupTitle}>{t(group.labelKey)}</Typography>
              )}
              {group.items.map((item) => {
                const count = overview && item.badge ? item.badge(overview) : 0;
                return (
                  <Box
                    key={item.id}
                    component="button"
                    type="button"
                    onClick={() => setPane(item.id)}
                    sx={s.navItem(pane === item.id)}
                    aria-current={pane === item.id ? 'page' : undefined}
                  >
                    {item.icon}
                    <Box component="span" sx={s.navLabel}>{t(`admin.tabs.${item.id}`)}</Box>
                    {count > 0 && <Box component="span" sx={s.navBadge}>{count}</Box>}
                  </Box>
                );
              })}
            </Box>
          ))}
        </GlassCard>

        <Box sx={s.main}>
          <Suspense fallback={<PaneFallback />}>
            {pane === 'overview' ? <AdminOverview onNavigate={setPane} /> : <Panel />}
          </Suspense>
        </Box>
      </Box>
    </PageWrapper>
  );
}
