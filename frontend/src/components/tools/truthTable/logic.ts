/**
 * Pure boolean-expression engine for the truth-table tool: tokenise → parse (recursive descent) →
 * evaluate over every variable assignment, then derive the canonical sum-of-products and a minimised
 * SOP via Quine–McCluskey (essential prime implicants + greedy cover). Side-effect free → unit-tested.
 *
 * Syntax: variables are single letters (A, B, P…). Operators (case-insensitive words or symbols):
 *   NOT  ! ~ ¬ not        AND  & && . * ∧ and        XOR  ^ ⊕ xor        OR  | + ∨ or
 * Constants 0/1, true/false. Precedence (low→high): OR < XOR < AND < NOT < atom; parentheses group.
 */

export type Node =
  | { type: 'const'; value: boolean }
  | { type: 'var'; name: string }
  | { type: 'not'; a: Node }
  | { type: 'and'; a: Node; b: Node }
  | { type: 'or'; a: Node; b: Node }
  | { type: 'xor'; a: Node; b: Node };

type Tok =
  | { t: 'lp' } | { t: 'rp' }
  | { t: 'not' } | { t: 'and' } | { t: 'or' } | { t: 'xor' }
  | { t: 'var'; name: string } | { t: 'const'; value: boolean };

const KEYWORDS: Record<string, Tok> = {
  not: { t: 'not' }, and: { t: 'and' }, or: { t: 'or' }, xor: { t: 'xor' },
  true: { t: 'const', value: true }, false: { t: 'const', value: false },
};

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(') { out.push({ t: 'lp' }); i++; continue; }
    if (c === ')') { out.push({ t: 'rp' }); i++; continue; }
    if (src.startsWith('&&', i)) { out.push({ t: 'and' }); i += 2; continue; }
    if (src.startsWith('||', i)) { out.push({ t: 'or' }); i += 2; continue; }
    if ('!~¬'.includes(c)) { out.push({ t: 'not' }); i++; continue; }
    if ('&.*∧'.includes(c)) { out.push({ t: 'and' }); i++; continue; }
    if ('|+∨'.includes(c)) { out.push({ t: 'or' }); i++; continue; }
    if ('^⊕'.includes(c)) { out.push({ t: 'xor' }); i++; continue; }
    if (c === '0' || c === '1') { out.push({ t: 'const', value: c === '1' }); i++; continue; }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z]/.test(src[j])) j++;
      const word = src.slice(i, j);
      const kw = KEYWORDS[word.toLowerCase()];
      if (kw) out.push(kw);
      else if (word.length === 1) out.push({ t: 'var', name: word.toUpperCase() });
      else throw new Error('invalid');
      i = j;
      continue;
    }
    throw new Error('invalid');
  }
  return out;
}

function parse(tokens: Tok[]): Node {
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = () => tokens[pos++];

  function parseOr(): Node {
    let node = parseXor();
    while (peek()?.t === 'or') { eat(); node = { type: 'or', a: node, b: parseXor() }; }
    return node;
  }
  function parseXor(): Node {
    let node = parseAnd();
    while (peek()?.t === 'xor') { eat(); node = { type: 'xor', a: node, b: parseAnd() }; }
    return node;
  }
  function parseAnd(): Node {
    let node = parseNot();
    while (peek()?.t === 'and') { eat(); node = { type: 'and', a: node, b: parseNot() }; }
    return node;
  }
  function parseNot(): Node {
    if (peek()?.t === 'not') { eat(); return { type: 'not', a: parseNot() }; }
    return parseAtom();
  }
  function parseAtom(): Node {
    const tok = peek();
    if (!tok) throw new Error('invalid');
    if (tok.t === 'lp') {
      eat();
      const node = parseOr();
      if (peek()?.t !== 'rp') throw new Error('invalid');
      eat();
      return node;
    }
    if (tok.t === 'var') { eat(); return { type: 'var', name: tok.name }; }
    if (tok.t === 'const') { eat(); return { type: 'const', value: tok.value }; }
    throw new Error('invalid');
  }

  const node = parseOr();
  if (pos !== tokens.length) throw new Error('invalid');
  return node;
}

function collectVars(node: Node, set: Set<string>): void {
  switch (node.type) {
    case 'var': set.add(node.name); break;
    case 'not': collectVars(node.a, set); break;
    case 'and': case 'or': case 'xor': collectVars(node.a, set); collectVars(node.b, set); break;
  }
}

function evaluate(node: Node, env: Record<string, boolean>): boolean {
  switch (node.type) {
    case 'const': return node.value;
    case 'var': return env[node.name];
    case 'not': return !evaluate(node.a, env);
    case 'and': return evaluate(node.a, env) && evaluate(node.b, env);
    case 'or': return evaluate(node.a, env) || evaluate(node.b, env);
    case 'xor': return evaluate(node.a, env) !== evaluate(node.b, env);
  }
}

export interface TruthRow { values: boolean[]; result: boolean }
export interface TruthResult {
  vars: string[];
  rows: TruthRow[];
  minterms: number[];
  canonicalSop: string;
  minimizedSop: string;
}

/** Negation glyph + middle dot for product terms (Karnaugh-style display). */
function termFromBits(bits: string, vars: string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') parts.push(vars[i]);
    else if (bits[i] === '0') parts.push(`¬${vars[i]}`);
  }
  return parts.length ? parts.join('·') : '1';
}

// ── Quine–McCluskey ──────────────────────────────────────────────
interface Imp { bits: string; mins: number[] }

function combine(a: string, b: string): string | null {
  let diff = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) { if (diff !== -1) return null; diff = i; }
  }
  return diff === -1 ? null : a.slice(0, diff) + '-' + a.slice(diff + 1);
}

function union(a: number[], b: number[]): number[] {
  return [...new Set([...a, ...b])].sort((x, y) => x - y);
}

function primeImplicants(minterms: number[], numVars: number): Imp[] {
  let current: Imp[] = minterms.map((m) => ({ bits: m.toString(2).padStart(numVars, '0'), mins: [m] }));
  const primes = new Map<string, Imp>();
  while (current.length) {
    const next = new Map<string, Imp>();
    const usedIdx = new Set<number>();
    for (let i = 0; i < current.length; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const c = combine(current[i].bits, current[j].bits);
        if (c) {
          usedIdx.add(i); usedIdx.add(j);
          const mins = union(current[i].mins, current[j].mins);
          const ex = next.get(c);
          if (ex) ex.mins = union(ex.mins, mins);
          else next.set(c, { bits: c, mins });
        }
      }
    }
    current.forEach((imp, idx) => { if (!usedIdx.has(idx)) primes.set(imp.bits, imp); });
    current = [...next.values()];
  }
  return [...primes.values()];
}

function selectCover(primes: Imp[], minterms: number[]): Imp[] {
  const remaining = new Set(minterms);
  const chosen: Imp[] = [];
  // Essential prime implicants: a minterm covered by exactly one prime forces that prime.
  for (const m of minterms) {
    const covering = primes.filter((p) => p.mins.includes(m));
    if (covering.length === 1 && !chosen.includes(covering[0])) chosen.push(covering[0]);
  }
  for (const p of chosen) for (const m of p.mins) remaining.delete(m);
  // Greedy cover for the rest (good enough at course scale; not full Petrick minimisation).
  while (remaining.size) {
    let best: Imp | null = null;
    let bestCount = 0;
    for (const p of primes) {
      if (chosen.includes(p)) continue;
      let c = 0;
      for (const m of p.mins) if (remaining.has(m)) c++;
      if (c > bestCount) { bestCount = c; best = p; }
    }
    if (!best) break;
    chosen.push(best);
    for (const m of best.mins) remaining.delete(m);
  }
  return chosen;
}

function minimize(minterms: number[], numVars: number, vars: string[]): string {
  if (minterms.length === 0) return '0';
  if (minterms.length === (1 << numVars)) return '1';
  const primes = primeImplicants(minterms, numVars);
  const cover = selectCover(primes, minterms);
  return cover.map((p) => termFromBits(p.bits, vars)).join(' + ');
}

/** Build the full truth table + canonical & minimised SOP. Throws Error('invalid'|'tooManyVars'). */
export function analyzeExpression(expr: string): TruthResult {
  if (!expr.trim()) throw new Error('invalid');
  const ast = parse(tokenize(expr));
  const set = new Set<string>();
  collectVars(ast, set);
  const vars = [...set].sort();
  if (vars.length > 8) throw new Error('tooManyVars');

  const n = vars.length;
  const rows: TruthRow[] = [];
  const minterms: number[] = [];
  const total = 1 << n;
  for (let mask = 0; mask < total; mask++) {
    const values: boolean[] = [];
    const env: Record<string, boolean> = {};
    for (let i = 0; i < n; i++) {
      const bit = (mask >> (n - 1 - i)) & 1;
      values.push(bit === 1);
      env[vars[i]] = bit === 1;
    }
    const result = evaluate(ast, env);
    rows.push({ values, result });
    if (result) minterms.push(mask);
  }

  const canonicalSop = minterms.length === 0
    ? '0'
    : minterms.length === total
      ? '1'
      : minterms.map((m) => termFromBits(m.toString(2).padStart(n, '0'), vars)).join(' + ');

  return { vars, rows, minterms, canonicalSop, minimizedSop: minimize(minterms, n, vars) };
}
