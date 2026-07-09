import type { SxProps, Theme } from '@mui/material';
import { TOKENS } from '@/theme/tokens';

type Sx = SxProps<Theme>;

export const title: Sx = { fontWeight: 700, mb: 3 };

export const rankCell = (isTopThree: boolean): Sx => ({
  fontWeight: 700,
  color: isTopThree ? 'primary.main' : 'inherit',
});

// Podium colors — gold/silver/bronze for top 3.
export const podiumColors = {
  gold: '#FFD93D',
  silver: '#C9D6DF',
  bronze: '#CD7F32',
};

export const podiumGrid: Sx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
  gap: 2,
  mb: 3,
  alignItems: 'end',
};

export const podiumCard = (rank: 1 | 2 | 3): Sx => {
  const color = rank === 1 ? podiumColors.gold : rank === 2 ? podiumColors.silver : podiumColors.bronze;
  // Center card (rank 1) sits taller and last in DOM order, but visual order is 2-1-3 via CSS order.
  return {
    p: 2.5,
    textAlign: 'center',
    borderRadius: 3,
    border: `2px solid ${color}`,
    background: `linear-gradient(180deg, ${color}1A 0%, transparent 60%)`,
    order: { xs: rank, sm: rank === 1 ? 2 : rank === 2 ? 1 : 3 },
    minHeight: rank === 1 ? 220 : 180,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 1,
    transition: 'transform 0.2s',
    cursor: 'pointer',
    '&:hover': { transform: 'translateY(-4px)' },
  };
};

export const podiumRank = (rank: 1 | 2 | 3): Sx => ({
  fontSize: rank === 1 ? '2rem' : '1.5rem',
  fontWeight: 800,
  color:
    rank === 1 ? podiumColors.gold : rank === 2 ? podiumColors.silver : podiumColors.bronze,
});

export const podiumAvatarSize = (rank: 1 | 2 | 3) => (rank === 1 ? 72 : 56);

export const layoutGrid: Sx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' },
  gap: 3,
  alignItems: 'flex-start',
};

// Mobile cards list — visible only below md, replaces the horizontal-scrolling table.
export const mobileList: Sx = {
  display: { xs: 'flex', md: 'none' },
  flexDirection: 'column',
  gap: 1.5,
};

export const sidebar: Sx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  position: { md: 'sticky' },
  top: { md: 88 }, // navbar offset
};

export const yourRankCard: Sx = {
  p: 2.5,
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
};

export const ROW_AVATAR_SIZE = 32;

export const userCell: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
};

// Sticky header (~41px) + 7 lignes entières (~65px) : 480 coupait la 7e ligne à mi-hauteur,
// ce qui donnait l'impression d'un rendu cassé. La scrollbar signale la suite du classement.
export const scrollableTable: Sx = {
  maxHeight: 500,
  '& .MuiTableCell-head': {
    bgcolor: (t) =>
      t.palette.mode === 'dark' ? 'rgba(18, 22, 36, 0.98)' : 'rgba(255, 255, 255, 0.98)',
    backdropFilter: 'blur(8px)',
    fontWeight: 700,
    color: 'text.primary',
  },
  '&::-webkit-scrollbar': { width: 8 },
  '&::-webkit-scrollbar-track': { background: 'transparent' },
  '&::-webkit-scrollbar-thumb': {
    background: (t) =>
      t.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.2)',
    borderRadius: 4,
  },
  '&::-webkit-scrollbar-thumb:hover': {
    background: (t) =>
      t.palette.mode === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)',
  },
};

export const currentUserRow: Sx = {
  bgcolor: (t) =>
    t.palette.mode === 'dark' ? 'rgba(0, 210, 255, 0.08)' : 'rgba(0, 145, 179, 0.08)',
  '& td': {
    borderLeft: `3px solid ${TOKENS.rating.main}`,
  },
};
