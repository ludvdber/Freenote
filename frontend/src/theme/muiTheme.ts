import { createTheme, alpha, type Theme, type ThemeOptions } from '@mui/material/styles';
import { TOKENS } from './tokens';
import { accentFor, DEFAULT_ACCENT } from '@/lib/palettes';
import './palette.d';

/**
 * Skeleton « aurore » (maquette Poussière d'étoile, 2026-07-09) : le balayage `wave` prend la
 * teinte de l'accent (cyan→violet par défaut, la palette du supporter sinon) au lieu du blanc MUI.
 * Le kill-switch global prefers-reduced-motion de MuiCssBaseline neutralise l'animation.
 */
const skeletonOverrides = (mode: 'dark' | 'light', primary: string, secondary: string) => ({
  defaultProps: { animation: 'wave' as const },
  styleOverrides: {
    root: {
      backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(10,14,26,0.06)',
      '&::after': {
        background: `linear-gradient(90deg, transparent, ${alpha(primary, mode === 'dark' ? 0.10 : 0.09)} 45%, ${alpha(secondary, mode === 'dark' ? 0.12 : 0.09)} 55%, transparent)`,
      },
    },
  },
});

const commonOptions: ThemeOptions = {
  typography: {
    fontFamily: '"Nunito", sans-serif',
    h1: { fontWeight: 800 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Visited news links (a11y + UX: lets users track what they've read)
        'a:visited': {
          // Only affects text-decoration colors; MUI components set their own
          // color so this is a progressive enhancement.
        },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 20,
        },
      },
    },
  },
};

/**
 * Construit le thème MUI. `accentId` (palette d'accent, perk supporters) remplace uniquement
 * primary/secondary + la couleur de focus — le fond cosmique, les glass tokens et les couleurs de
 * marque (TOKENS) ne bougent pas. Sans palette (null/inconnu) : thème historique à l'identique.
 */
/**
 * Fond étoilé GLOBAL (validé sur maquette « Poussière d'étoile », 2026-07-09) : l'identité cosmique
 * ne vivait que dans le hero — dès le premier scroll, fond uni. Étoiles statiques + 2 nébuleuses
 * très diluées en CSS pur (zéro JS, zéro asset, rien n'est animé donc reduced-motion-safe).
 * `fixed` : le ciel ne défile pas avec le contenu (iOS l'ignore et dégrade proprement).
 * Les DEUX nébuleuses prennent la teinte de l'accent (palette supporter) — les étoiles restent
 * neutres. Sans palette, mêmes valeurs qu'avant (primary/secondary = cyan/violet par défaut).
 */
const starfield = (mode: 'dark' | 'light', primary: string, secondary: string): string => (
  mode === 'dark'
    ? [
      'radial-gradient(1.5px 1.5px at 12% 18%, rgba(255,255,255,0.22) 45%, transparent 55%)',
      'radial-gradient(1px 1px at 34% 62%, rgba(255,255,255,0.13) 45%, transparent 55%)',
      'radial-gradient(1.5px 1.5px at 58% 9%, rgba(255,255,255,0.18) 45%, transparent 55%)',
      'radial-gradient(1px 1px at 71% 41%, rgba(255,255,255,0.12) 45%, transparent 55%)',
      'radial-gradient(2px 2px at 86% 74%, rgba(160,220,255,0.15) 45%, transparent 55%)',
      'radial-gradient(1px 1px at 21% 87%, rgba(255,255,255,0.11) 45%, transparent 55%)',
      'radial-gradient(1.5px 1.5px at 47% 33%, rgba(210,180,255,0.13) 45%, transparent 55%)',
      'radial-gradient(1px 1px at 92% 15%, rgba(255,255,255,0.15) 45%, transparent 55%)',
      'radial-gradient(1px 1px at 65% 88%, rgba(255,255,255,0.10) 45%, transparent 55%)',
      `radial-gradient(900px 480px at 85% -10%, ${alpha(secondary, 0.07)}, transparent 60%)`,
      `radial-gradient(700px 420px at -10% 55%, ${alpha(primary, 0.04)}, transparent 60%)`,
    ].join(', ')
    : [
      'radial-gradient(1.5px 1.5px at 12% 18%, rgba(30,41,72,0.14) 45%, transparent 55%)',
      'radial-gradient(1px 1px at 34% 62%, rgba(30,41,72,0.09) 45%, transparent 55%)',
      'radial-gradient(1.5px 1.5px at 58% 9%, rgba(76,29,149,0.11) 45%, transparent 55%)',
      'radial-gradient(1px 1px at 71% 41%, rgba(30,41,72,0.08) 45%, transparent 55%)',
      'radial-gradient(2px 2px at 86% 74%, rgba(0,98,163,0.10) 45%, transparent 55%)',
      'radial-gradient(1px 1px at 21% 87%, rgba(30,41,72,0.07) 45%, transparent 55%)',
      'radial-gradient(1.5px 1.5px at 47% 33%, rgba(76,29,149,0.09) 45%, transparent 55%)',
      'radial-gradient(1px 1px at 92% 15%, rgba(30,41,72,0.10) 45%, transparent 55%)',
      `radial-gradient(900px 480px at 85% -10%, ${alpha(secondary, 0.05)}, transparent 60%)`,
      `radial-gradient(700px 420px at -10% 55%, ${alpha(primary, 0.04)}, transparent 60%)`,
    ].join(', ')
);

export function buildTheme(mode: 'dark' | 'light', accentId?: string | null): Theme {
  const accent = accentFor(accentId);

  if (mode === 'dark') {
    const primary = accent ? accent.dark.primary : DEFAULT_ACCENT.dark.primary;
    const secondary = accent ? accent.dark.secondary : DEFAULT_ACCENT.dark.secondary;
    return createTheme({
      ...commonOptions,
      palette: {
        mode: 'dark',
        primary: { main: primary },
        secondary: { main: secondary },
        background: {
          default: '#0a0e1a',
          // Keep paper transparent so the cosmic background shows through glass cards
          paper: 'rgba(255, 255, 255, 0.04)',
        },
        tokens: TOKENS,
      },
      components: {
        ...commonOptions.components,
        MuiCssBaseline: {
          ...commonOptions.components?.MuiCssBaseline,
          styleOverrides: {
            ...(commonOptions.components?.MuiCssBaseline as Record<string, unknown>)?.styleOverrides as Record<string, unknown>,
            ':focus-visible': {
              outline: `2px solid ${primary}`,
              outlineOffset: 2,
              borderRadius: 8,
            },
            body: {
              backgroundImage: starfield('dark', primary, secondary),
              backgroundAttachment: 'fixed',
            },
          },
        },
        MuiCard: {
          defaultProps: {
            elevation: 0,
          },
          styleOverrides: {
            root: {
              borderRadius: 16,
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              backgroundImage: 'none',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              boxShadow: 'none',
            },
          },
        },
        MuiPaper: {
          defaultProps: {
            elevation: 0,
          },
          styleOverrides: {
            root: {
              backgroundImage: 'none !important',
              boxShadow: 'none',
            },
          },
        },
        MuiMenu: {
          styleOverrides: {
            paper: {
              backgroundColor: 'rgba(18, 22, 36, 0.98) !important',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
            },
          },
        },
        MuiAutocomplete: {
          styleOverrides: {
            paper: {
              backgroundColor: 'rgba(18, 22, 36, 0.98) !important',
              backgroundImage: 'none !important',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
            },
          },
        },
        MuiDialog: {
          styleOverrides: {
            paper: {
              backgroundColor: 'rgba(18, 22, 36, 0.98) !important',
              backgroundImage: 'none !important',
            },
          },
        },
        MuiSkeleton: skeletonOverrides('dark', primary, secondary),
      },
    });
  }

  const primary = accent ? accent.light.primary : DEFAULT_ACCENT.light.primary;
  const secondary = accent ? accent.light.secondary : DEFAULT_ACCENT.light.secondary;
  return createTheme({
    ...commonOptions,
    palette: {
      mode: 'light',
      primary: { main: primary },
      secondary: { main: secondary },
      background: {
        default: '#f0f4f8',
        paper: 'rgba(255, 255, 255, 0.7)',
      },
      tokens: TOKENS,
    },
    components: {
      ...commonOptions.components,
      MuiCssBaseline: {
        ...commonOptions.components?.MuiCssBaseline,
        styleOverrides: {
          ...(commonOptions.components?.MuiCssBaseline as Record<string, unknown>)?.styleOverrides as Record<string, unknown>,
          ':focus-visible': {
            // Le focus par défaut clair reste #0062a3 (plus sombre que primary pour le contraste).
            outline: `2px solid ${accent ? accent.light.primary : '#0062a3'}`,
            outlineOffset: 2,
            borderRadius: 8,
          },
          body: {
            backgroundImage: starfield('light', primary, secondary),
            backgroundAttachment: 'fixed',
          },
        },
      },
      MuiCard: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            borderRadius: 16,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            backgroundImage: 'none',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: 'none',
          },
        },
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundImage: 'none !important',
            boxShadow: 'none',
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: 'rgba(255, 255, 255, 0.98) !important',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
          },
        },
      },
      MuiAutocomplete: {
        styleOverrides: {
          paper: {
            backgroundColor: 'rgba(255, 255, 255, 0.98) !important',
            backgroundImage: 'none !important',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: 'rgba(255, 255, 255, 0.98) !important',
            backgroundImage: 'none !important',
          },
        },
      },
      MuiSkeleton: skeletonOverrides('light', primary, secondary),
    },
  });
}
