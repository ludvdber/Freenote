import type { ReactNode } from 'react';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FavoriteIcon from '@mui/icons-material/Favorite';
import SchoolIcon from '@mui/icons-material/School';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import BugReportIcon from '@mui/icons-material/BugReport';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import HandymanIcon from '@mui/icons-material/Handyman';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import PersonIcon from '@mui/icons-material/Person';
import { KOFI_URL, GITHUB_URL } from '@/lib/constants';

export interface Shortcut {
  key: string;
  icon: ReactNode;
  to?: string;
  href?: string;
  requireVerified?: boolean;
}

// Ordre par importance, avec deux ancres fixes : « Offrir un café » en PREMIER, « Signaler un bug »
// en DERNIER (demande Ludovic). 9 tuiles = grille 3×3 pleine.
export const SHORTCUTS: Shortcut[] = [
  { key: 'kofi',        icon: <VolunteerActivismIcon />, href: KOFI_URL },
  { key: 'share',       icon: <CloudUploadIcon />,       to: '/upload',                requireVerified: true },
  { key: 'mySection',   icon: <SchoolIcon />,            to: '/browse' },
  { key: 'favorites',   icon: <FavoriteIcon />,          to: '/profile?tab=favorites' },
  { key: 'tools',       icon: <HandymanIcon />,          to: '/outils' },
  { key: 'leaderboard', icon: <LeaderboardIcon />,       to: '/leaderboard' },
  { key: 'news',        icon: <NewspaperIcon />,         to: '/news' },
  { key: 'profile',     icon: <PersonIcon />,            to: '/profile' },
  { key: 'bug',         icon: <BugReportIcon />,         href: `${GITHUB_URL}/issues/new` },
];
