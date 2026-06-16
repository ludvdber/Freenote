import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'fr', changeLanguage: vi.fn() } }),
}));

import ConfirmDialog from '../ConfirmDialog';

const base = {
  title: 'Supprimer ?',
  message: 'Action irréversible',
  confirmLabel: 'Supprimer',
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

describe('ConfirmDialog', () => {
  it('does not render its content when closed', () => {
    render(<ConfirmDialog open={false} {...base} />);
    expect(screen.queryByText('Supprimer ?')).not.toBeInTheDocument();
  });

  it('renders title/message and uses the default cancel label', () => {
    render(<ConfirmDialog open {...base} />);
    expect(screen.getByText('Supprimer ?')).toBeInTheDocument();
    expect(screen.getByText('Action irréversible')).toBeInTheDocument();
    expect(screen.getByText('common.cancel')).toBeInTheDocument();
  });

  it('fires onConfirm and onClose', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmDialog open {...base} cancelLabel="Annuler" onConfirm={onConfirm} onClose={onClose} />);

    expect(screen.getByText('Annuler')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Supprimer'));
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Annuler'));
    expect(onClose).toHaveBeenCalled();
  });

  it('disables the confirm button while loading', () => {
    render(<ConfirmDialog open {...base} loading confirmLabel="OK" />);
    expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();
  });
});
