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
