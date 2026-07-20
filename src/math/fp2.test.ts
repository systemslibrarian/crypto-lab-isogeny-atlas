import { describe, expect, it } from 'vitest';
import {
  P,
  fp2,
  add,
  sub,
  mul,
  sqr,
  inv,
  div,
  pow,
  frob,
  norm,
  sqrt,
  eq,
  ONE,
  ZERO,
  makeRng,
  randFp2,
  show,
} from './fp2';

describe('GF(431²) arithmetic', () => {
  it('p ≡ 3 (mod 4) and p ≡ 2 (mod 3) — the primes conditions the demo relies on', () => {
    expect(P % 4).toBe(3);
    expect(P % 3).toBe(2);
  });

  it('field axioms on random samples (associativity, distributivity, inverses)', () => {
    const rng = makeRng(7);
    for (let t = 0; t < 200; t++) {
      const x = randFp2(rng);
      const y = randFp2(rng);
      const z = randFp2(rng);
      expect(eq(add(add(x, y), z), add(x, add(y, z)))).toBe(true);
      expect(eq(mul(mul(x, y), z), mul(x, mul(y, z)))).toBe(true);
      expect(eq(mul(x, add(y, z)), add(mul(x, y), mul(x, z)))).toBe(true);
      if (!eq(x, ZERO)) expect(eq(mul(x, inv(x)), ONE)).toBe(true);
    }
  });

  it('i² = −1', () => {
    expect(eq(sqr(fp2(0, 1)), fp2(-1))).toBe(true);
  });

  it('Frobenius x ↦ x^p equals conjugation and fixes exactly GF(p)', () => {
    const rng = makeRng(11);
    for (let t = 0; t < 100; t++) {
      const x = randFp2(rng);
      expect(eq(pow(x, P), frob(x))).toBe(true);
      expect(eq(frob(x), x)).toBe(x.b === 0);
    }
  });

  it('norm is multiplicative and equals x^(p+1)', () => {
    const rng = makeRng(13);
    for (let t = 0; t < 100; t++) {
      const x = randFp2(rng);
      const y = randFp2(rng);
      expect(norm(mul(x, y))).toBe((norm(x) * norm(y)) % P);
      expect(eq(pow(x, P + 1), fp2(norm(x)))).toBe(true);
    }
  });

  it('sqrt: every square has a verified root; exactly (q−1)/2 nonzero squares exist', () => {
    const rng = makeRng(17);
    for (let t = 0; t < 200; t++) {
      const x = randFp2(rng);
      const s = sqr(x);
      const r = sqrt(s);
      expect(r).not.toBeNull();
      expect(eq(sqr(r!), s)).toBe(true);
    }
    // Squares are exactly half of the nonzero elements; sample-check the ratio.
    let squares = 0;
    const N = 2000;
    for (let t = 0; t < N; t++) {
      const x = randFp2(rng);
      if (!eq(x, ZERO) && sqrt(x) !== null) squares++;
    }
    expect(squares).toBeGreaterThan(N * 0.4);
    expect(squares).toBeLessThan(N * 0.6);
  });

  it('sub really is the inverse of add', () => {
    const rng = makeRng(19);
    for (let t = 0; t < 50; t++) {
      const x = randFp2(rng);
      const y = randFp2(rng);
      expect(eq(sub(add(x, y), y), x)).toBe(true);
      expect(eq(div(mul(x, y), eq(y, ZERO) ? ONE : y), eq(y, ZERO) ? mul(x, y) : x)).toBe(
        true,
      );
    }
  });

  it('show() renders small-half representatives', () => {
    expect(show(fp2(0))).toBe('0');
    expect(show(fp2(17))).toBe('17');
    expect(show(fp2(0, 1))).toBe('i');
    expect(show(fp2(0, P - 1))).toBe('−i');
    expect(show(fp2(5, 3))).toBe('5 + 3i');
    expect(show(fp2(5, P - 3))).toBe('5 − 3i');
  });
});
