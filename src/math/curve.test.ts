/**
 * Independent supersingularity verification: the atlas is discovered purely
 * through modular polynomials; here we rebuild each vertex as an actual
 * elliptic curve and verify with genuine point arithmetic that it is
 * supersingular. Two independent roads, one answer — that is the point.
 */
import { describe, expect, it } from 'vitest';
import {
  curveFromJ,
  jInvariant,
  onCurve,
  ptAdd,
  ptMul,
  randomPoint,
  supersingularTrace,
  countPointsFp,
  discriminantNonzero,
} from './curve';
import { buildAtlas } from './graph';
import { fp2, eq, makeRng, P, inFp } from './fp2';

const atlas = buildAtlas();

describe('elliptic curves over GF(431²)', () => {
  it('curveFromJ round-trips the j-invariant for every atlas vertex', () => {
    for (const j of atlas.nodes) {
      const c = curveFromJ(j);
      expect(discriminantNonzero(c)).toBe(true);
      expect(eq(jInvariant(c), j)).toBe(true);
    }
  });

  it('group law: random points stay on the curve; [m+n]P = [m]P + [n]P', () => {
    const rng = makeRng(47);
    const c = curveFromJ(fp2(1728));
    for (let t = 0; t < 20; t++) {
      const pt = randomPoint(c, rng);
      expect(onCurve(c, pt)).toBe(true);
      const m = 1 + (rng() % 500);
      const n = 1 + (rng() % 500);
      const lhs = ptMul(c, m + n, pt);
      const rhs = ptAdd(c, ptMul(c, m, pt), ptMul(c, n, pt));
      expect(onCurve(c, lhs)).toBe(true);
      if (lhs === null || rhs === null) expect(lhs).toBe(rhs);
      else {
        expect(eq(lhs.x, rhs.x)).toBe(true);
        expect(eq(lhs.y, rhs.y)).toBe(true);
      }
    }
  });

  it('KAT 16 — deterministic: every GF(p)-rational vertex has #E(GF(p)) = p + 1 (trace 0)', () => {
    for (const j of atlas.nodes.filter(inFp)) {
      const count = countPointsFp(curveFromJ(j));
      expect(count).toBe(P + 1);
    }
  });

  it('KAT 17 — every atlas vertex is supersingular by the Frobenius-trace point test', () => {
    const rng = makeRng(53);
    for (const j of atlas.nodes) {
      const t = supersingularTrace(curveFromJ(j), rng);
      expect(t).not.toBeNull();
      expect([0, P, -P, 2 * P, -2 * P]).toContain(t);
    }
  });

  it('control: ordinary curves FAIL the supersingularity test (the test has teeth)', () => {
    const rng = makeRng(59);
    // j = 1, 2, 3 … are ordinary for p = 431 unless they appear in the atlas.
    let checked = 0;
    for (let a = 1; a < 40 && checked < 5; a++) {
      const j = fp2(a);
      if (atlas.index.has(`${j.a},${j.b}`)) continue;
      expect(supersingularTrace(curveFromJ(j), rng)).toBeNull();
      checked++;
    }
    expect(checked).toBe(5);
  });
});
