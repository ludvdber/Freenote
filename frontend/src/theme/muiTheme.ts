import { createTheme, type ThemeOptions } from '@mui/material/styles';
import { TOKENS } from './tokens';
import './palette.d';

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

export const darkTheme = createTheme({
  ...commonOptions,
  palette: {
    mode: 'dark',
    primary: { main: '#00d2ff' },
    secondary: { main: '#7b2ff7' },
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
          outline: '2px solid #00d2ff',
          outlineOffset: 2,
          borderRadius: 8,
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
  },
});

export const lightTheme = createTheme({
  ...commonOptions,
  palette: {
    mode: 'light',
    primary: { main: '#0091b3' },
    secondary: { main: '#6a1be0' },
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
          outline: '2px solid #0062a3',
          outlineOffset: 2,
          borderRadius: 8,
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
  },
});
