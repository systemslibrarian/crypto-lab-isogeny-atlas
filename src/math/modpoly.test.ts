/**
 * Known-answer tests for the modular polynomials — characteristic-0 CM facts
 * checked with exact BigInt arithmetic. These are classical identities: a
 * cyclic ℓ-isogeny between CM curves exists exactly when their orders are
 * related by index ℓ (or ℓ splits/ramifies in the CM order), and the
 * j-invariants of small-discriminant CM curves are classical constants.
 */
import { describe, expect, it } from 'vitest';
import { PHI2, PHI3, phiEvalInt, phiEvalFp2, phiSpecialize } from './modpoly';
import { fp2, makeRng, eq, ZERO, key } from './fp2';
import { evalAt, roots, deg } from './poly';

// Classical CM j-invariants: j(disc):
//   j(−3) = 0, j(−4) = 1728, j(−7) = −3375, j(−8) = 8000, j(−11) = −32768,
//   j(−12) = 54000, j(−16) = 287496 = 66³, j(−27) = −12288000, j(−28) = 16581375.
const J = {
  d3: 0n,
  d4: 1728n,
  d7: -3375n,
  d8: 8000n,
  d12: 54000n,
  d16: 287496n,
  d27: -12288000n,
  d28: 16581375n,
} as const;

describe('Φ₂ spec KATs (exact integers)', () => {
  it('KAT 1 — Φ₂(1728, 66³) = 0: the 2-isogeny between disc −4 and disc −16', () => {
    expect(phiEvalInt(PHI2, J.d4, J.d16)).toBe(0n);
  });
  it('KAT 2 — Φ₂(0, 54000) = 0: the 2-isogeny between disc −3 and disc −12', () => {
    expect(phiEvalInt(PHI2, J.d3, J.d12)).toBe(0n);
  });
  it('KAT 3 — Φ₂(8000, 8000) = 0: 2 ramifies in Z[√−2], a 2-endomorphism', () => {
    expect(phiEvalInt(PHI2, J.d8, J.d8)).toBe(0n);
  });
  it('KAT 4 — Φ₂(1728, 1728) = 0: 2 ramifies in Z[i] ((1+i)² = 2i)', () => {
    expect(phiEvalInt(PHI2, J.d4, J.d4)).toBe(0n);
  });
  it('KAT 5 — Φ₂(−3375, 16581375) = 0: the 2-isogeny between disc −7 and disc −28', () => {
    expect(phiEvalInt(PHI2, J.d7, J.d28)).toBe(0n);
  });
  it('KAT 6 — Φ₂(0, 0) ≠ 0: 2 is inert in Z[ζ₃], no 2-endomorphism of E₀', () => {
    expect(phiEvalInt(PHI2, J.d3, J.d3)).not.toBe(0n);
  });
  it('Φ₂ is symmetric: Φ₂(X, Y) = Φ₂(Y, X) on random integer points', () => {
    for (const [x, y] of [
      [5n, 11n],
      [-100n, 77n],
      [123456n, -654321n],
    ] as const) {
      expect(phiEvalInt(PHI2, x, y)).toBe(phiEvalInt(PHI2, y, x));
    }
  });
});

describe('Φ₃ spec KATs (exact integers)', () => {
  it('KAT 7 — Φ₃(0, 0) = 0: 3 ramifies in Z[ζ₃] ((√−3)² = −3), a 3-endomorphism of E₀', () => {
    expect(phiEvalInt(PHI3, J.d3, J.d3)).toBe(0n);
  });
  it('KAT 8 — Φ₃(0, −12288000) = 0: the 3-isogeny between disc −3 and disc −27', () => {
    expect(phiEvalInt(PHI3, J.d3, J.d27)).toBe(0n);
  });
  it('KAT 9 — Φ₃(1728, 1728) ≠ 0: 3 is inert in Z[i], no 3-endomorphism of E₁₇₂₈', () => {
    expect(phiEvalInt(PHI3, J.d4, J.d4)).not.toBe(0n);
  });
  it('Φ₃ is symmetric on random integer points', () => {
    for (const [x, y] of [
      [7n, 13n],
      [-42n, 999n],
      [31337n, -161803n],
    ] as const) {
      expect(phiEvalInt(PHI3, x, y)).toBe(phiEvalInt(PHI3, y, x));
    }
  });
});

describe('Φ mod p consistency', () => {
  it('phiSpecialize(j, Y) evaluated at y matches phiEvalFp2(j, y)', () => {
    const rng = makeRng(41);
    for (let t = 0; t < 30; t++) {
      const j = fp2(rng() % 431, rng() % 431);
      const y = fp2(rng() % 431, rng() % 431);
      for (const table of [PHI2, PHI3]) {
        expect(eq(evalAt(phiSpecialize(table, j), y), phiEvalFp2(table, j, y))).toBe(true);
      }
    }
  });
  it('specialized Φ_ℓ(j, Y) has degree ℓ + 1', () => {
    expect(deg(phiSpecialize(PHI2, fp2(1728)))).toBe(3);
    expect(deg(phiSpecialize(PHI3, fp2(1728)))).toBe(4);
  });
  it('the char-0 KATs survive reduction mod p: Φ₂(1728 mod p, 66³ mod p) = 0 in GF(p)', () => {
    expect(eq(phiEvalFp2(PHI2, fp2(1728), fp2(287496 % 431)), ZERO)).toBe(true);
    expect(eq(phiEvalFp2(PHI3, fp2(0), fp2(((-12288000 % 431) + 431) % 431)), ZERO)).toBe(
      true,
    );
  });
  it('multiplicity structure at j = 1728: Φ₂(1728, Y) = (Y − 1728)(Y − 66³)² in char 0 → mod p roots {1728: 1, 66³: 2}', () => {
    const rng = makeRng(43);
    const rs = roots(phiSpecialize(PHI2, fp2(1728)), rng);
    expect(rs.get(key(fp2(1728)))).toBe(1);
    expect(rs.get(key(fp2(287496)))).toBe(2);
  });
});
