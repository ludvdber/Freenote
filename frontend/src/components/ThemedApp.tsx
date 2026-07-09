import { useEffect, useMemo } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { useThemeStore } from '@/stores/useThemeStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { buildTheme } from '@/theme/muiTheme';
import { useAuthInit } from '@/hooks/useAuthInit';
import { useNotificationsStream } from '@/hooks/useNotificationsStream';
import { trackVisit } from '@/lib/track';
import App from '@/App';

export default function ThemedApp() {
  const theme = useThemeStore((s) => s.theme);
  // Palette d'accent (perk supporters) — le backend renvoie null quand l'entitlement a expiré,
  // donc le thème retombe tout seul sur le défaut sans action de l'utilisateur.
  const accentPalette = useAuthStore((s) => s.user?.accentPalette ?? null);
  useAuthInit();
  useNotificationsStream();

  // Statistique de visite anonyme (1 par session navigateur, classée par provenance) —
  // fire-and-forget, aucune donnée personnelle.
  useEffect(() => {
    trackVisit();
  }, []);

  const muiTheme = useMemo(() => buildTheme(theme, accentPalette), [theme, accentPalette]);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  );
}
