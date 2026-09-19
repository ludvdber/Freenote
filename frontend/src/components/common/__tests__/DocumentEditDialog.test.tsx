import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'fr', changeLanguage: vi.fn() } }),
}));

vi.mock('@/api/endpoints', () => ({
  getSections: vi.fn(),
  getCourses: vi.fn(),
  getProfessors: vi.fn(),
  updateOwnDocument: vi.fn(),
  adminUpdateDocument: vi.fn(),
}));

import {
  getSections,
  getCourses,
  getProfessors,
  updateOwnDocument,
  adminUpdateDocument,
} from '@/api/endpoints';
import DocumentEditDialog from '../DocumentEditDialog';
import type { DocumentResponse } from '@/types';

function makeDoc(over: Partial<DocumentResponse> = {}): DocumentResponse {
  return {
    id: 42,
    title: 'Algo notes',
    courseId: 10,
    courseName: 'Algo',
    sectionId: 1,
    sectionName: 'Informatique',
    category: 'SYNTHESE',
    authorName: 'Sophie',
    authorId: 7,
    verified: true,
    aiGenerated: false,
    language: 'FR',
    year: '2025',
    professorName: 'Dupont',
    professorId: 3,
    averageRating: 0,
    ratingCount: 0,
    downloadCount: 0,
    authorAvatarUrl: null,
    owned: true,
    createdAt: '2026-06-16T10:00:00Z',
    ...over,
  } as DocumentResponse;
}

function renderDialog(doc: DocumentResponse, mode: 'owner' | 'admin' = 'owner', onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <DocumentEditDialog open doc={doc} mode={mode} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { ...utils, onClose };
}

const save = () => screen.getByRole('button', { name: 'common.save' });

/** Le Switch MUI rend un <input type="checkbox"> ; on le cible par son type plutôt que par un
 *  rôle ARIA, qui varie d'une version de MUI à l'autre. */
const verifiedSwitch = () =>
  document.querySelector('.MuiSwitch-root input[type="checkbox"]') as HTMLInputElement | null;

describe('DocumentEditDialog', () => {
  beforeEach(() => {
    vi.mocked(getSections).mockResolvedValue([
      { id: 1, name: 'Informatique' },
      { id: 2, name: 'Comptabilité' },
    ] as any);
    vi.mocked(getCourses).mockResolvedValue([
      { id: 10, name: 'Algo' },
      { id: 11, name: 'Réseaux' },
    ] as any);
    vi.mocked(getProfessors).mockResolvedValue([
      { id: 3, name: 'Dupont' },
      { id: 4, name: 'Martin' },
    ]);
    vi.mocked(updateOwnDocument).mockResolvedValue(makeDoc());
    vi.mocked(adminUpdateDocument).mockResolvedValue(makeDoc());
  });

  it('pré-remplit le formulaire avec les valeurs du document', () => {
    renderDialog(makeDoc());
    expect(screen.getByDisplayValue('Algo notes')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2025')).toBeInTheDocument();
    expect(screen.getByDisplayValue('FR')).toBeInTheDocument();
  });

  /**
   * L'interrupteur « Vérifié » est réservé à la modération : personne ne se vérifie soi-même.
   * C'est aussi le contrôle qui n'existait NULLE PART avant (le champ était pré-rempli mais sans
   * aucun élément d'interface), ce qui rendait la dé-vérification impossible.
   */
  it("n'expose l'interrupteur Vérifié qu'en mode admin", () => {
    const { unmount } = renderDialog(makeDoc(), 'owner');
    expect(verifiedSwitch()).toBeNull();
    unmount();

    renderDialog(makeDoc(), 'admin');
    expect(verifiedSwitch()).not.toBeNull();
  });

  it('envoie la modification du propriétaire sur la route propriétaire', async () => {
    const user = userEvent.setup();
    renderDialog(makeDoc(), 'owner');

    await user.click(save());

    await waitFor(() => expect(updateOwnDocument).toHaveBeenCalled());
    expect(adminUpdateDocument).not.toHaveBeenCalled();
    const [id, payload] = vi.mocked(updateOwnDocument).mock.calls[0];
    expect(id).toBe(42);
    // Le propriétaire ne pilote jamais la vérification, même si le document est vérifié.
    expect(payload.verified).toBeUndefined();
    expect(payload.title).toBe('Algo notes');
    expect(payload.courseId).toBe(10);
  });

  it('envoie la modification du staff sur la route admin, vérification comprise', async () => {
    const user = userEvent.setup();
    renderDialog(makeDoc({ verified: true }), 'admin');

    await user.click(verifiedSwitch()!); // dé-vérifier
    await user.click(save());

    await waitFor(() => expect(adminUpdateDocument).toHaveBeenCalled());
    expect(updateOwnDocument).not.toHaveBeenCalled();
    expect(vi.mocked(adminUpdateDocument).mock.calls[0][1].verified).toBe(false);
  });

  /**
   * `professorId: undefined` veut déjà dire « ne pas toucher » côté serveur : sans le drapeau
   * explicite, un professeur posé par erreur ne pouvait plus JAMAIS être retiré.
   */
  it('demande explicitement le détachement quand on vide le professeur', async () => {
    const user = userEvent.setup();
    renderDialog(makeDoc({ professorId: 3, professorName: 'Dupont' }), 'owner');

    await user.clear(screen.getByDisplayValue('Dupont'));
    await user.click(save());

    await waitFor(() => expect(updateOwnDocument).toHaveBeenCalled());
    const payload = vi.mocked(updateOwnDocument).mock.calls[0][1];
    expect(payload.clearProfessor).toBe(true);
    expect(payload.professorId).toBeUndefined();
  });

  it("n'envoie pas de détachement quand il n'y avait déjà aucun professeur", async () => {
    const user = userEvent.setup();
    renderDialog(makeDoc({ professorId: null, professorName: null }), 'owner');

    await user.click(save());

    await waitFor(() => expect(updateOwnDocument).toHaveBeenCalled());
    expect(vi.mocked(updateOwnDocument).mock.calls[0][1].clearProfessor).toBeUndefined();
  });

  it('refuse un titre vide', async () => {
    const user = userEvent.setup();
    renderDialog(makeDoc(), 'owner');

    await user.clear(screen.getByDisplayValue('Algo notes'));

    expect(save()).toBeDisabled();
    expect(updateOwnDocument).not.toHaveBeenCalled();
  });

  /** Un document sans cours n'a pas de place dans le catalogue : la sauvegarde reste bloquée. */
  it('refuse un document sans cours', () => {
    renderDialog(makeDoc({ courseId: null as unknown as number, sectionId: null }), 'owner');
    expect(save()).toBeDisabled();
    expect(screen.getByText('document.editCourseRequired')).toBeInTheDocument();
  });

  // fireEvent plutôt que user.type : un collage vaut un seul événement, là où 60 frappes
  // simulées dépassent le délai des tests sous instrumentation de couverture.
  it("borne le titre à 50 caractères et affiche le compteur", () => {
    renderDialog(makeDoc({ title: '' }), 'owner');

    const input = screen.getByLabelText('document.title') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'x'.repeat(60) } });

    expect(input.value).toHaveLength(50);
    expect(screen.getByText('50/50')).toBeInTheDocument();
  });

  it("ne garde que les chiffres de l'année, sur 4 positions", () => {
    renderDialog(makeDoc({ year: '' }), 'owner');

    const input = screen.getByLabelText('document.year') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '20a25XY' } });

    expect(input.value).toBe('2025');
  });

  it('ferme sans rien envoyer sur Annuler', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog(makeDoc(), 'owner');

    await user.click(screen.getByRole('button', { name: 'common.cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(updateOwnDocument).not.toHaveBeenCalled();
  });
});
