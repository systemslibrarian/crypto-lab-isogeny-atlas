import { describe, expect, it } from 'vitest';
import { fp2, makeRng, key, ONE, ZERO, neg } from './fp2';
import {
  type Poly,
  trim,
  polyMul,
  polyAdd,
  divmod,
  gcd,
  evalAt,
  roots,
  bruteRoots,
  polyIsZero,
  monic,
  polyEq,
} from './poly';
import { phiSpecialize, PHI2, PHI3 } from './modpoly';

const lin = (r: ReturnType<typeof fp2>): Poly => trim([neg(r), ONE]);

describe('polynomials over GF(431²)', () => {
  it('division: f = q·g + r with deg r < deg g, on random inputs', () => {
    const rng = makeRng(23);
    const randPoly = (d: number): Poly =>
      trim(Array.from({ length: d + 1 }, () => fp2(rng() % 431, rng() % 431)));
    for (let t = 0; t < 40; t++) {
      const f = randPoly(6);
      const g = randPoly(3);
      if (polyIsZero(g)) continue;
      const { q, r } = divmod(f, g);
      expect(polyEq(polyAdd(polyMul(q, g), r), f)).toBe(true);
      expect(r.length).toBeLessThan(g.length);
    }
  });

  it('gcd of products with a shared factor finds the factor', () => {
    const r1 = fp2(12, 34);
    const r2 = fp2(56, 78);
    const r3 = fp2(90, 11);
    const f = polyMul(lin(r1), lin(r2));
    const g = polyMul(lin(r1), lin(r3));
    expect(polyEq(gcd(f, g), monic(lin(r1)))).toBe(true);
  });

  it('roots() recovers constructed roots with multiplicities', () => {
    const rng = makeRng(29);
    const a = fp2(3, 7);
    const b = fp2(100, 0);
    const f = polyMul(polyMul(lin(a), lin(a)), lin(b)); // (Y−a)²(Y−b)
    const rs = roots(f, rng);
    expect(rs.get(key(a))).toBe(2);
    expect(rs.get(key(b))).toBe(1);
    expect(rs.size).toBe(2);
  });

  it('Cantor–Zassenhaus agrees with the brute-force scan on Φ₂(1728, Y) and Φ₃(1728, Y)', () => {
    const rng = makeRng(31);
    for (const table of [PHI2, PHI3]) {
      const f = phiSpecialize(table, fp2(1728));
      const fast = roots(f, rng);
      const brute = bruteRoots(f);
      expect(fast.size).toBe(brute.size);
      for (const [k, m] of brute) expect(fast.get(k)).toBe(m);
    }
  });

  it('every reported root really evaluates to zero', () => {
    const rng = makeRng(37);
    const f = phiSpecialize(PHI3, fp2(0));
    for (const k of roots(f, rng).keys()) {
      const [a, b] = k.split(',').map(Number);
      expect(evalAt(f, fp2(a, b))).toEqual(ZERO);
    }
  });
});
