import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { isValidIp, calculateIPv4 } from '@/lib/ipv4';
import { isValidForBase, convertBase } from '@/lib/baseConverter';

// Mock i18n — return the key (or a few known labels) so the UI renders predictably.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'tools.ipv4.invalidIp': 'IP invalide',
        'tools.base.invalidChar': 'Caractère invalide',
      };
      return map[key] ?? key;
    },
    i18n: { language: 'fr', changeLanguage: vi.fn() },
  }),
}));

// Mock framer-motion to plain elements
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...filterDomProps(props)}>{children}</div>,
    section: ({ children, ...props }: any) => <section {...filterDomProps(props)}>{children}</section>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

function filterDomProps(props: Record<string, any>) {
  const invalid = ['initial', 'animate', 'exit', 'transition', 'whileInView', 'whileHover', 'viewport', 'variants'];
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!invalid.includes(key)) clean[key] = value;
  }
  return clean;
}

import IPv4Calculator from '@/components/tools/IPv4Calculator';
import BaseConverter from '@/components/tools/BaseConverter';

// --- Pure logic tests (no DOM, 100% reliable) ---

describe('IPv4 lib — calculateIPv4', () => {
  it('should calculate network from 192.168.1.100/24', () => {
    const result = calculateIPv4('192.168.1.100', 24)!;
    expect(result.network).toBe('192.168.1.0');
    expect(result.broadcast).toBe('192.168.1.255');
    expect(result.hostCount).toBe(254);
    expect(result.maskDecimal).toBe('255.255.255.0');
    expect(result.ipClass).toBe('C');
  });

  it('should reject invalid IP', () => {
    expect(isValidIp('999.999.999.999')).toBe(false);
    expect(calculateIPv4('999.999.999.999', 24)).toBeNull();
  });

  it('should handle /32 (single host)', () => {
    const result = calculateIPv4('10.0.0.1', 32)!;
    expect(result.hostCount).toBe(1);
    expect(result.network).toBe('10.0.0.1');
    expect(result.broadcast).toBe('10.0.0.1');
  });
});

describe('BaseConverter lib — convertBase', () => {
  it('should convert 255 decimal to bin/oct/hex', () => {
    const result = convertBase('255', 10)!;
    expect(result[2]).toBe('11111111');
    expect(result[8]).toBe('377');
    expect(result[16]).toBe('FF');
  });

  it('should reject invalid binary input', () => {
    expect(isValidForBase('29', 2)).toBe(false);
    expect(convertBase('29', 2)).toBeNull();
  });

  it('should accept valid binary input', () => {
    expect(isValidForBase('1010', 2)).toBe(true);
    const result = convertBase('1010', 2)!;
    expect(result[10]).toBe('10');
    expect(result[16]).toBe('A');
  });
});

// --- Component tests (each tool is a standalone component now) ---

describe('IPv4Calculator', () => {
  // IPv4Calculator now carries a cross-link (RouterLink) to the IPv6 tool, so it needs a Router context.
  const renderIPv4 = () => render(<MemoryRouter><IPv4Calculator /></MemoryRouter>);

  it('should show results for default IP 192.168.1.100/24', () => {
    renderIPv4();
    expect(screen.getByText('192.168.1.0')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.255')).toBeInTheDocument();
    expect(screen.getByText('254')).toBeInTheDocument();
  });

  it('should show error for invalid IP', async () => {
    const user = userEvent.setup();
    renderIPv4();

    const ipInput = screen.getByDisplayValue('192.168.1.100');
    await user.clear(ipInput);
    await user.type(ipInput, '999.999.999.999');

    expect(screen.getByText('IP invalide')).toBeInTheDocument();
  });
});

describe('BaseConverter', () => {
  it('should convert decimal 255 to binary, octal, hex', async () => {
    const user = userEvent.setup();
    render(<BaseConverter />);

    const input = screen.getByDisplayValue('42');
    await user.clear(input);
    await user.type(input, '255');

    await waitFor(() => {
      expect(screen.getByText('11111111')).toBeInTheDocument();
      expect(screen.getByText('377')).toBeInTheDocument();
      expect(screen.getByText('FF')).toBeInTheDocument();
    });
  });
});
