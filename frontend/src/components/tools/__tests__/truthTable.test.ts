import { describe, it, expect } from 'vitest';
import { analyzeExpression } from '../truthTable/logic';

describe('truthTable — table building', () => {
  it('builds the table and minterms for AND', () => {
    const r = analyzeExpression('A and B');
    expect(r.vars).toEqual(['A', 'B']);
    expect(r.rows).toHaveLength(4);
    expect(r.minterms).toEqual([3]);
    expect(r.canonicalSop).toBe('A·B');
    expect(r.minimizedSop).toBe('A·B');
  });

  it('parses symbols and keywords equivalently', () => {
    expect(analyzeExpression('A & B').minterms).toEqual(analyzeExpression('A and B').minterms);
    expect(analyzeExpression('!A').minterms).toEqual(analyzeExpression('not A').minterms);
    expect(analyzeExpression('A | B').minterms).toEqual([1, 2, 3]);
  });
});

describe('truthTable — Quine–McCluskey minimisation', () => {
  it('minimises OR to two single-literal terms', () => {
    const r = analyzeExpression('A or B');
    expect(['A + B', 'B + A']).toContain(r.minimizedSop);
  });

  it('leaves XOR as two product terms', () => {
    const r = analyzeExpression('A xor B');
    expect(r.minterms).toEqual([1, 2]);
    expect(r.minimizedSop).toContain('¬A·B');
    expect(r.minimizedSop).toContain('A·¬B');
  });

  it('absorbs a redundant variable (A·B + A·¬B = A)', () => {
    const r = analyzeExpression('(A and B) or (A and not B)');
    expect(r.minimizedSop).toBe('A');
  });

  it('handles tautology and contradiction', () => {
    expect(analyzeExpression('A or not A').minimizedSop).toBe('1');
    expect(analyzeExpression('A and not A').minimizedSop).toBe('0');
  });

  it('rejects invalid input', () => {
    expect(() => analyzeExpression('A and')).toThrow();
    expect(() => analyzeExpression('')).toThrow();
  });
});
