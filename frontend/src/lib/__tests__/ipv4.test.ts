import { describe, it, expect } from 'vitest';
import { isValidIp, cidrToMaskOctets, parseMaskDecimal, calculateIPv4 } from '../ipv4';

describe('isValidIp', () => {
  it('accepts valid and rejects malformed addresses', () => {
    expect(isValidIp('0.0.0.0')).toBe(true);
    expect(isValidIp('255.255.255.255')).toBe(true);
    expect(isValidIp('192.168.1.1')).toBe(true);
    expect(isValidIp('256.0.0.1')).toBe(false);
    expect(isValidIp('1.2.3')).toBe(false);
    expect(isValidIp('a.b.c.d')).toBe(false);
    expect(isValidIp('-1.0.0.0')).toBe(false);
  });
});

describe('cidrToMaskOctets', () => {
  it('handles /0, /24 and /32', () => {
    expect(cidrToMaskOctets(0)).toEqual([0, 0, 0, 0]);
    expect(cidrToMaskOctets(24)).toEqual([255, 255, 255, 0]);
    expect(cidrToMaskOctets(32)).toEqual([255, 255, 255, 255]);
    expect(cidrToMaskOctets(26)).toEqual([255, 255, 255, 192]);
  });
});

describe('parseMaskDecimal', () => {
  it('converts a valid contiguous mask to its CIDR', () => {
    expect(parseMaskDecimal('255.255.255.0')).toBe(24);
    expect(parseMaskDecimal('0.0.0.0')).toBe(0);
    expect(parseMaskDecimal('255.255.255.255')).toBe(32);
    expect(parseMaskDecimal('255.255.255.192')).toBe(26);
  });

  it('rejects non-contiguous or malformed masks', () => {
    expect(parseMaskDecimal('255.0.255.0')).toBeNull(); // not contiguous
    expect(parseMaskDecimal('255.255.255')).toBeNull(); // wrong length
    expect(parseMaskDecimal('255.255.300.0')).toBeNull(); // out of range
  });
});

describe('calculateIPv4', () => {
  it('computes a /24 network', () => {
    const r = calculateIPv4('192.168.1.100', 24)!;
    expect(r.network).toBe('192.168.1.0');
    expect(r.broadcast).toBe('192.168.1.255');
    expect(r.firstHost).toBe('192.168.1.1');
    expect(r.lastHost).toBe('192.168.1.254');
    expect(r.hostCount).toBe(254);
    expect(r.wildcard).toBe('0.0.0.255');
    expect(r.cidr).toBe('/24');
    expect(r.maskDecimal).toBe('255.255.255.0');
    expect(r.ipBinary).toHaveLength(32);
    expect(r.maskBinary).toBe('1'.repeat(24) + '0'.repeat(8));
  });

  it('handles /31 (point-to-point) and /32 (single host)', () => {
    const p2p = calculateIPv4('10.0.0.0', 31)!;
    expect(p2p.hostCount).toBe(2);
    expect(p2p.firstHost).toBe('10.0.0.0');
    expect(p2p.lastHost).toBe('10.0.0.1');

    const single = calculateIPv4('10.0.0.5', 32)!;
    expect(single.hostCount).toBe(1);
    expect(single.network).toBe('10.0.0.5');
    expect(single.broadcast).toBe('10.0.0.5');
  });

  it('detects address classes A–E', () => {
    expect(calculateIPv4('10.0.0.1', 8)!.ipClass).toBe('A');
    expect(calculateIPv4('172.16.0.1', 16)!.ipClass).toBe('B');
    expect(calculateIPv4('192.168.0.1', 24)!.ipClass).toBe('C');
    expect(calculateIPv4('224.0.0.1', 4)!.ipClass).toBe('D');
    expect(calculateIPv4('240.0.0.1', 4)!.ipClass).toBe('E');
  });

  it('returns null for invalid IP or CIDR', () => {
    expect(calculateIPv4('999.0.0.0', 24)).toBeNull();
    expect(calculateIPv4('10.0.0.0', -1)).toBeNull();
    expect(calculateIPv4('10.0.0.0', 33)).toBeNull();
  });
});
