export interface NavLink {
  key: string;
  to: string;
  /** If true, the link is behind ProtectedRoute — clicking it while logged out shows
   *  the auth-prompt snackbar instead of navigating (no flash, no round trip). */
  protected?: boolean;
}

export const NAV_LINKS: NavLink[] = [
  { key: 'home',        to: '/' },
  { key: 'browse',      to: '/browse' },                     // Public : vitrine anonyme intégrée
  { key: 'leaderboard', to: '/leaderboard', protected: true },
  { key: 'news',        to: '/news' },                       // Flux RSS école, public
  // { key: 'guides',   to: '/guides' },                     // Masqué pour l'instant (contenu pas prêt) — routes + backend intacts, décommenter pour ré-afficher
  { key: 'tools',       to: '/outils' },
];
