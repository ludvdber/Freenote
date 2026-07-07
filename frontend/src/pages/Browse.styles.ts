import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

export const title: Sx = { fontWeight: 700, mb: 3 };

export const filtersRow: Sx = {
  display: 'flex',
  gap: 2,
  mb: 4,
  flexWrap: 'wrap',
};

export const searchCol: Sx = { flex: 1, minWidth: 200 };

export const filterControl: Sx = { minWidth: 140 };

// Chips catégories (remplacent le dropdown, maquette 6 validée) : filtre 1-clic + légende des
// couleurs de couvertures. La chip active prend la teinte de sa catégorie.
export const quickCats: Sx = {
  display: 'flex',
  gap: 1,
  flexWrap: 'wrap',
  mb: 2.5,
};

export const quickCat = (active: boolean, color: string): Sx => ({
  fontWeight: 700,
  transition: 'color 0.15s, border-color 0.15s, transform 0.15s',
  ...(active
    ? {
        bgcolor: `${color}1f`,
        color,
        border: `1px solid ${color}80`,
        // MUI Chip clickable garde son bgcolor de hover par défaut — on le fixe pour que la
        // chip active ne « grise » pas au survol.
        '&:hover': { bgcolor: `${color}2e` },
      }
    : {
        color: 'text.secondary',
        border: (t) =>
          `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)'}`,
        bgcolor: 'transparent',
        '&:hover': { color, borderColor: color, transform: 'translateY(-1px)' },
      }),
});

export const pageSizeControl: Sx = { ml: 'auto', minWidth: 108 };

export const emptyText: Sx = { textAlign: 'center', py: 8 };

// Barre au-dessus de la grille : « N documents » + chips des filtres actifs (supprimables).
export const resultsBar: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  flexWrap: 'wrap',
  mb: 2,
};

export const resultsCount: Sx = { fontWeight: 600 };
