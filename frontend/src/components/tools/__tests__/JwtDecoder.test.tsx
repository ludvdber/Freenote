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

import JwtDecoder from '../JwtDecoder';

const b64url = (o: unknown) =>
  btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function getTokenInput() {
  return screen.getByLabelText('tools.jwt.tokenLabel');
}

describe('JwtDecoder', () => {
  it('decodes a valid token header + payload', () => {
    render(<JwtDecoder />);
    const token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: '123', exp: 9999999999 })}.sig`;
    fireEvent.change(getTokenInput(), { target: { value: token } });

    // header pre contains the algorithm; payload pre contains the subject
    expect(screen.getByText(/HS256/)).toBeInTheDocument();
    expect(screen.getByText(/"sub": "123"/)).toBeInTheDocument();
    // future exp → "still valid" chip
    expect(screen.getByText('tools.jwt.valid')).toBeInTheDocument();
  });

  it('flags an expired token', () => {
    render(<JwtDecoder />);
    const token = `${b64url({ alg: 'HS256' })}.${b64url({ exp: 1 })}.sig`;
    fireEvent.change(getTokenInput(), { target: { value: token } });
    expect(screen.getByText('tools.jwt.expired')).toBeInTheDocument();
  });

  it('shows an error for a malformed token (wrong segment count)', () => {
    render(<JwtDecoder />);
    fireEvent.change(getTokenInput(), { target: { value: 'only.two' } });
    expect(screen.getByText('tools.jwt.invalidFormat')).toBeInTheDocument();
  });

  it('shows nothing decoded for an empty input', () => {
    render(<JwtDecoder />);
    expect(screen.queryByText('tools.jwt.header')).not.toBeInTheDocument();
  });
});
