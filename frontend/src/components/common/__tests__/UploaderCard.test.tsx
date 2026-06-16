import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'fr', changeLanguage: vi.fn() } }),
}));

vi.mock('@/api/endpoints', () => ({
  getUserById: vi.fn(),
  getUserRank: vi.fn(),
}));

import { getUserById, getUserRank } from '@/api/endpoints';
import UploaderCard from '../UploaderCard';

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><UploaderCard authorId={7} /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('UploaderCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the full uploader identity (verified, supporter, rank, section)', async () => {
    vi.mocked(getUserById).mockResolvedValue({
      id: 7, username: 'sophie_m', displayName: 'Sophie M', avatarUrl: null,
      verified: true, supporter: true, xp: 120, documentCount: 8, sectionName: 'Informatique',
    } as never);
    vi.mocked(getUserRank).mockResolvedValue(3 as never);

    renderCard();

    expect(await screen.findByText('Sophie M')).toBeInTheDocument();
    expect(screen.getByText('@sophie_m')).toBeInTheDocument();
    expect(screen.getByText('profile.verified')).toBeInTheDocument();
    expect(screen.getByText('document.supporter')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
    expect(screen.getByText('Informatique')).toBeInTheDocument();
  });

  it('omits optional chips for a minimal user', async () => {
    vi.mocked(getUserById).mockResolvedValue({
      id: 9, username: 'lea', displayName: 'lea', avatarUrl: null,
      verified: false, supporter: false, xp: 0, documentCount: 0, sectionName: null,
    } as never);
    vi.mocked(getUserRank).mockResolvedValue(null as never);

    renderCard();

    expect(await screen.findByText('lea')).toBeInTheDocument();
    expect(screen.queryByText('@lea')).not.toBeInTheDocument();
    expect(screen.queryByText('profile.verified')).not.toBeInTheDocument();
    expect(screen.queryByText('document.supporter')).not.toBeInTheDocument();
  });
});
