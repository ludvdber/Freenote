import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'fr', changeLanguage: vi.fn() } }),
}));

import StarRating from '../StarRating';

describe('StarRating', () => {
  it('renders five stars in a labelled group', () => {
    render(<StarRating value={3} />);
    expect(screen.getByRole('group', { name: 'document.rating' })).toBeInTheDocument();
    expect(screen.getByLabelText('1/5')).toBeInTheDocument();
    expect(screen.getByLabelText('5/5')).toBeInTheDocument();
  });

  it('calls onChange when a star is clicked', () => {
    const onChange = vi.fn();
    render(<StarRating value={0} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('4/5'));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('supports keyboard selection (Enter / Space)', () => {
    const onChange = vi.fn();
    render(<StarRating value={0} onChange={onChange} />);
    fireEvent.keyDown(screen.getByLabelText('2/5'), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(2);
    fireEvent.keyDown(screen.getByLabelText('5/5'), { key: ' ' });
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('updates the hover preview on mouse enter/leave without firing onChange', () => {
    const onChange = vi.fn();
    render(<StarRating value={1} onChange={onChange} />);
    fireEvent.mouseEnter(screen.getByLabelText('4/5'));
    fireEvent.mouseLeave(screen.getByRole('group', { name: 'document.rating' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is inert in read-only mode', () => {
    const onChange = vi.fn();
    render(<StarRating value={3} readOnly onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('5/5'));
    fireEvent.keyDown(screen.getByLabelText('1/5'), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
