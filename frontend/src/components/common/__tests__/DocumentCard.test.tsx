import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'fr', changeLanguage: vi.fn() } }),
}));

const { shareOrCopy } = vi.hoisted(() => ({ shareOrCopy: vi.fn().mockResolvedValue('copied') }));
vi.mock('@/lib/utils', async (orig) => {
  const actual = await orig<typeof import('@/lib/utils')>();
  return { ...actual, shareOrCopy };
});

import DocumentCard from '../DocumentCard';
import type { DocumentResponse } from '@/types';

function makeDoc(over: Partial<DocumentResponse> = {}): DocumentResponse {
  return {
    id: 1,
    title: 'Algo notes',
    courseName: 'Algo',
    authorName: 'Sophie',
    category: 'SYNTHESE',
    verified: false,
    aiGenerated: false,
    averageRating: 4,
    downloadCount: 12,
    createdAt: '2026-06-16T10:00:00Z',
    ...over,
  } as DocumentResponse;
}

const renderCard = (doc: DocumentResponse) =>
  render(<MemoryRouter><DocumentCard document={doc} /></MemoryRouter>);

describe('DocumentCard', () => {
  it('renders title, course/author and view count', () => {
    renderCard(makeDoc());
    expect(screen.getByText('Algo notes')).toBeInTheDocument();
    expect(screen.getByText('Algo · Sophie')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('shows verified and AI badges only when flagged', () => {
    const { unmount } = renderCard(makeDoc({ verified: true, aiGenerated: true }));
    expect(screen.getByText('document.verified')).toBeInTheDocument();
    expect(screen.getByText('document.aiShort')).toBeInTheDocument();
    unmount();

    renderCard(makeDoc({ verified: false, aiGenerated: false }));
    expect(screen.queryByText('document.verified')).not.toBeInTheDocument();
    expect(screen.queryByText('document.aiShort')).not.toBeInTheDocument();
  });

  it('shares the document and shows a confirmation snackbar', async () => {
    renderCard(makeDoc());
    // The only <button> in the card is the share IconButton (the card itself is an <a>).
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(shareOrCopy).toHaveBeenCalled());
    expect(await screen.findByText('common.linkCopied')).toBeInTheDocument();
  });
});
