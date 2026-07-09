import type { ReactNode } from 'react';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FavoriteIcon from '@mui/icons-material/Favorite';
import SchoolIcon from '@mui/icons-material/School';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import BugReportIcon from '@mui/icons-material/BugReport';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import HandymanIcon from '@mui/icons-material/Handyman';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { KOFI_URL, GITHUB_URL } from '@/lib/constants';

export interface Shortcut {
  key: string;
  icon: ReactNode;
  to?: string;
  href?: string;
  requireVerified?: boolean;
  /** Bouton Ko-fi : passe par le dialog global qui montre le code « FN-… » (compte vérifié). */
  kofi?: boolean;
  /** Hiérarchie visuelle : les 9 tuiles au même poids mettaient « Signaler un bug » au niveau
   *  de « Partager un doc ». primary = grande tuile accentuée ; utility = rangée fine. */
  variant?: 'primary' | 'utility';
}

// Ordre par importance, avec deux ancres fixes : « Offrir un café » en PREMIER, « Signaler un bug »
// en DERNIER (demande Ludovic). « Mon profil » a cédé sa place à « Réviser » (2026-07-08) — le
// profil reste à un clic via l'avatar de la navbar.
export const SHORTCUTS: Shortcut[] = [
  { key: 'kofi',        icon: <VolunteerActivismIcon />, href: KOFI_URL, kofi: true,   variant: 'primary' },
  { key: 'share',       icon: <CloudUploadIcon />,       to: '/upload',                requireVerified: true, variant: 'primary' },
  { key: 'mySection',   icon: <SchoolIcon />,            to: '/browse' },
  { key: 'reviser',     icon: <MenuBookIcon />,          to: '/reviser' },
  { key: 'favorites',   icon: <FavoriteIcon />,          to: '/profile?tab=favorites' },
  { key: 'tools',       icon: <HandymanIcon />,          to: '/outils' },
  { key: 'leaderboard', icon: <LeaderboardIcon />,       to: '/leaderboard' },
  { key: 'news',        icon: <NewspaperIcon />,         to: '/news' },
  { key: 'bug',         icon: <BugReportIcon />,         href: `${GITHUB_URL}/issues/new`, variant: 'utility' },
];
