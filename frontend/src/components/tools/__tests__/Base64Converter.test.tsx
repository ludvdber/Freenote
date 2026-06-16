import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'fr', changeLanguage: vi.fn() } }),
}));
vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...p }: any) => <div {...strip(p)}>{children}</div> },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));
function strip(p: Record<string, any>) {
  const bad = ['initial', 'animate', 'exit', 'transition', 'variants'];
  return Object.fromEntries(Object.entries(p).filter(([k]) => !bad.includes(k)));
}

import Base64Converter from '../Base64Converter';

describe('Base64Converter', () => {
  it('encodes text to Base64', () => {
    render(<Base64Converter />);
    fireEvent.change(screen.getByLabelText('tools.base64.input'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByText('tools.base64.encode'));
    expect(screen.getByText('SGVsbG8=')).toBeInTheDocument();
  });

  it('decodes Base64 back to text (UTF-8 safe)', () => {
    render(<Base64Converter />);
    fireEvent.change(screen.getByLabelText('tools.base64.input'), { target: { value: 'Qm9uam91cg==' } });
    fireEvent.click(screen.getByText('tools.base64.decode'));
    expect(screen.getByText('Bonjour')).toBeInTheDocument();
  });

  it('shows an error when decoding invalid Base64', () => {
    render(<Base64Converter />);
    fireEvent.change(screen.getByLabelText('tools.base64.input'), { target: { value: '@@@not-base64@@@' } });
    fireEvent.click(screen.getByText('tools.base64.decode'));
    expect(screen.getByText('tools.base64.invalid')).toBeInTheDocument();
  });
});
