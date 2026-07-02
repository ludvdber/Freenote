import { describe, it, expect } from 'vitest';
import { analyze, compress, expand, addressToBigInt, parseIpv6 } from '../ipv6/logic';

describe('ipv6 — parsing & formatting', () => {
  it('expands and compresses round-trip', () => {
    const v = addressToBigInt('2001:db8::1');
    expect(expand(v)).toBe('2001:0db8:0000:0000:0000:0000:0000:0001');
    expect(compress(v)).toBe('2001:db8::1');
  });

  it('compresses all-zero to ::', () => {
    expect(compress(0n)).toBe('::');
    expect(compress(1n)).toBe('::1');
  });

  it('rejects garbage and bad prefixes', () => {
    expect(() => addressToBigInt('xyz')).toThrow();
    expect(() => addressToBigInt('1::2::3')).toThrow();
    expect(() => parseIpv6('2001:db8::1/129')).toThrow();
  });
});

describe('ipv6 — subnetting', () => {
  it('computes the network, last address and count for /64', () => {
    const info = analyze('2001:db8:abcd:1234:5678::1/64');
    expect(info.prefix).toBe(64);
    expect(info.network).toBe('2001:db8:abcd:1234::');
    expect(info.lastAddress).toBe('2001:db8:abcd:1234:ffff:ffff:ffff:ffff');
    expect(info.addressCount).toBe((2n ** 64n).toString());
    expect(info.scope).toBe('global');
  });

  it('detects address scopes', () => {
    expect(analyze('::1').scope).toBe('loopback');
    expect(analyze('fe80::1').scope).toBe('linkLocal');
    expect(analyze('fc00::1').scope).toBe('uniqueLocal');
    expect(analyze('ff02::1').scope).toBe('multicast');
    expect(analyze('::').scope).toBe('unspecified');
  });
});
