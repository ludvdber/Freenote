/**
 * Pure, framework-free IPv6 subnetting logic (128-bit math via BigInt). Parses an address (with `::`
 * compression), validates it, and derives the network/first/last address, address count and scope.
 * Deterministic + side-effect free → unit-tested in isolation; the React component only wires it to
 * inputs and rendering.
 */

const FULL = (1n << 128n) - 1n;

export interface Ipv6Info {
  full: string;          // fully expanded, e.g. 2001:0db8:0000:...:0001
  compressed: string;    // RFC 5952 compressed
  prefix: number;        // /n
  network: string;       // compressed network address
  networkFull: string;   // expanded network address
  firstAddress: string;  // compressed
  lastAddress: string;   // compressed
  addressCount: string;  // decimal string (can be astronomically large)
  scope: string;         // i18n key suffix: global | linkLocal | uniqueLocal | loopback | unspecified | multicast | reserved
}

/** Parse "addr" or "addr/prefix"; throws Error('invalid') / Error('prefix') on bad input. */
export function parseIpv6(input: string): { value: bigint; prefix: number } {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('invalid');
  const [addr, prefixStr] = trimmed.split('/');
  let prefix = 128;
  if (prefixStr !== undefined) {
    if (!/^\d{1,3}$/.test(prefixStr)) throw new Error('prefix');
    prefix = Number(prefixStr);
    if (prefix < 0 || prefix > 128) throw new Error('prefix');
  }
  return { value: addressToBigInt(addr), prefix };
}

/** Expand an address string to its 128-bit value. Supports a single `::` run. */
export function addressToBigInt(addr: string): bigint {
  if (addr.length === 0 || /[^0-9a-fA-F:]/.test(addr)) throw new Error('invalid');
  if ((addr.match(/::/g) ?? []).length > 1) throw new Error('invalid');

  let groups: string[];
  if (addr.includes('::')) {
    const [left, right] = addr.split('::');
    const l = left ? left.split(':') : [];
    const r = right ? right.split(':') : [];
    const missing = 8 - (l.length + r.length);
    if (missing < 1) throw new Error('invalid'); // :: must stand for ≥1 zero group
    groups = [...l, ...Array(missing).fill('0'), ...r];
  } else {
    groups = addr.split(':');
  }
  if (groups.length !== 8) throw new Error('invalid');

  let value = 0n;
  for (const g of groups) {
    if (g === '' || g.length > 4 || !/^[0-9a-fA-F]+$/.test(g)) throw new Error('invalid');
    value = (value << 16n) | BigInt(parseInt(g, 16));
  }
  return value;
}

/** Fully expanded form: 8 groups of 4 lowercase hex digits. */
export function expand(value: bigint): string {
  const groups: string[] = [];
  for (let i = 7; i >= 0; i--) {
    const g = (value >> BigInt(i * 16)) & 0xffffn;
    groups.push(g.toString(16).padStart(4, '0'));
  }
  return groups.join(':');
}

/** RFC 5952 compressed form (lowercase, no leading zeros, longest zero-run → `::`). */
export function compress(value: bigint): string {
  const groups: number[] = [];
  for (let i = 7; i >= 0; i--) groups.push(Number((value >> BigInt(i * 16)) & 0xffffn));

  // Find the longest run of consecutive zero groups (length ≥ 2), leftmost wins on ties.
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < 8; i++) {
    if (groups[i] === 0) {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }

  const hex = groups.map((g) => g.toString(16));
  if (bestLen < 2) return hex.join(':');

  const head = hex.slice(0, bestStart).join(':');
  const tail = hex.slice(bestStart + bestLen).join(':');
  return `${head}::${tail}`;
}

function scopeOf(value: bigint): string {
  if (value === 0n) return 'unspecified';
  if (value === 1n) return 'loopback';
  const top8 = value >> 120n;
  if (top8 === 0xffn) return 'multicast';            // ff00::/8
  const top10 = value >> 118n;
  if (top10 === 0x3fan) return 'linkLocal';          // fe80::/10  (0xfe80>>6 = 0x3fa)
  const top7 = value >> 121n;
  if (top7 === 0x7en) return 'uniqueLocal';          // fc00::/7   (0xfc>>1 = 0x7e)
  const top3 = value >> 125n;
  if (top3 === 0x1n) return 'global';                // 2000::/3
  return 'reserved';
}

export function subnetInfo(value: bigint, prefix: number): Ipv6Info {
  const hostBits = BigInt(128 - prefix);
  const hostMask = hostBits === 0n ? 0n : (1n << hostBits) - 1n;
  const network = value & (FULL ^ hostMask);
  const last = network | hostMask;
  const count = 1n << hostBits;
  return {
    full: expand(value),
    compressed: compress(value),
    prefix,
    network: compress(network),
    networkFull: expand(network),
    firstAddress: compress(network),
    lastAddress: compress(last),
    addressCount: count.toString(),
    scope: scopeOf(value),
  };
}

/** Convenience: parse + compute in one call. Throws on invalid input. */
export function analyze(input: string): Ipv6Info {
  const { value, prefix } = parseIpv6(input);
  return subnetInfo(value, prefix);
}
