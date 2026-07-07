import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'fr', changeLanguage: vi.fn() } }),
}));

import DocumentCard from '../DocumentCard';
import type { DocumentResponse } from '@/types';

function makeDoc(over: Partial<DocumentResponse> = {}): DocumentResponse {
  return {
    id: 1,
    title: 'Algo notes',
    courseName: 'Algo',
    sectionName: 'Informatique',
    authorName: 'Sophie',
    authorAvatarUrl: null,
    category: 'SYNTHESE',
    verified: true,
    aiGenerated: false,
    averageRating: 0,
    ratingCount: 0,
    downloadCount: 12,
    createdAt: '2026-06-16T10:00:00Z',
    ...over,
  } as DocumentResponse;
}

const renderCard = (doc: DocumentResponse, variant?: 'card' | 'row') =>
  render(<MemoryRouter><DocumentCard document={doc} variant={variant} /></MemoryRouter>);

describe('DocumentCard', () => {
  it('renders title, course · section line and view count — but NOT the author (dropped 2026-07-07)', () => {
    renderCard(makeDoc());
    expect(screen.getByText('Algo notes')).toBeInTheDocument();
    expect(screen.getByText('Algo · Informatique')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    // L'auteur vit sur /documents/:id (carte uploader), plus sur les cartes.
    expect(screen.queryByText('Sophie')).not.toBeInTheDocument();
  });

  it('puts the title BEFORE the category/year meta line (v3 hierarchy)', () => {
    renderCard(makeDoc({ year: '2025-2026' }));
    const title = screen.getByText('Algo notes');
    const year = screen.getByText('2025-2026');
    // compareDocumentPosition : FOLLOWING = l'année arrive APRÈS le titre dans le DOM.
    expect(title.compareDocumentPosition(year) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has no share button — the card links to the doc, nothing else is clickable', () => {
    renderCard(makeDoc());
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('hides the rating when nobody voted, shows value + count otherwise', () => {
    const { unmount } = renderCard(makeDoc({ ratingCount: 0 }));
    // Pas d'étoiles vides « note 0 » — rien tant que personne n'a voté.
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
    unmount();

    renderCard(makeDoc({ averageRating: 4.3, ratingCount: 12 }));
    expect(screen.getByText('4.3')).toBeInTheDocument();
    expect(screen.getByText('(12)')).toBeInTheDocument();
  });

  it('shows the pending chip only on unverified docs (no badge on verified ones)', () => {
    const { unmount } = renderCard(makeDoc({ verified: false }));
    expect(screen.getByText('document.pending')).toBeInTheDocument();
    unmount();

    renderCard(makeDoc({ verified: true }));
    expect(screen.queryByText('document.pending')).not.toBeInTheDocument();
    expect(screen.queryByText('document.verified')).not.toBeInTheDocument();
  });

  it('shows the AI chip only when flagged', () => {
    const { unmount } = renderCard(makeDoc({ aiGenerated: true }));
    expect(screen.getByText('document.aiShort')).toBeInTheDocument();
    unmount();

    renderCard(makeDoc({ aiGenerated: false }));
    expect(screen.queryByText('document.aiShort')).not.toBeInTheDocument();
  });

  it('shows « Nouveau » for a doc under 7 days, and 🔥 for a sustained-views doc', () => {
    const { unmount } = renderCard(makeDoc({ createdAt: new Date().toISOString() }));
    expect(screen.getByText('document.badgeNew')).toBeInTheDocument();
    unmount();

    // 60 jours, 300 vues → 5 vues/jour : hot (et plus « nouveau »).
    const old = new Date(Date.now() - 60 * 86_400_000).toISOString();
    renderCard(makeDoc({ createdAt: old, downloadCount: 300 }));
    expect(screen.queryByText('document.badgeNew')).not.toBeInTheDocument();
    expect(screen.getByText('🔥')).toBeInTheDocument();
  });

  it('renders the row variant (list view) with the same core info, author excluded', () => {
    renderCard(makeDoc({ averageRating: 4.3, ratingCount: 12 }), 'row');
    expect(screen.getByText('Algo notes')).toBeInTheDocument();
    expect(screen.getByText('Algo · Informatique')).toBeInTheDocument();
    expect(screen.getByText('4.3')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.queryByText('Sophie')).not.toBeInTheDocument();
  });
});
