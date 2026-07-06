import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'fr', changeLanguage: vi.fn() } }),
}));

import LevelChip, { levelNameSx } from '../LevelChip';
import LevelProgress from '../LevelProgress';

describe('LevelChip', () => {
  it('shows the tier matching the XP', () => {
    render(<LevelChip xp={400} />);
    expect(screen.getByText('levels.star')).toBeInTheDocument();
  });

  it('shows Galaxie at 3000+ XP', () => {
    render(<LevelChip xp={3200} />);
    expect(screen.getByText('levels.galaxy')).toBeInTheDocument();
  });

  it('clamps invalid XP to the first tier', () => {
    render(<LevelChip xp={-5} />);
    expect(screen.getByText('levels.stardust')).toBeInTheDocument();
  });
});

describe('levelNameSx', () => {
  it('returns a solid color below the top tier and a gradient at Galaxie', () => {
    expect(levelNameSx(400, 'dark')).toHaveProperty('color');
    expect(levelNameSx(5000, 'dark')).toHaveProperty('background');
  });
});

describe('LevelProgress', () => {
  it('renders the current and next tier around the bar', () => {
    render(<LevelProgress xp={390} />);
    expect(screen.getByText('levels.star')).toBeInTheDocument();
    expect(screen.getByText('levels.supernova')).toBeInTheDocument();
    expect(screen.getByText('390 / 720 XP')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows the max-tier message at Galaxie', () => {
    render(<LevelProgress xp={4000} />);
    expect(screen.getByText('levels.tooltipMax')).toBeInTheDocument();
  });
});
