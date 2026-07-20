/**
 * Short-Weierstrass elliptic curves y² = x³ + ax + b over GF(p²), used as an
 * INDEPENDENT verification of the graph: the atlas is discovered through the
 * modular polynomials alone, and these curves confirm — via genuine point
 * arithmetic — that every discovered j-invariant really is supersingular
 * (its curve's Frobenius trace over GF(p²) lies in {0, ±p, ±2p}).
 */

import {
  type Fp2,
  P,
  Q,
  ZERO,
  ONE,
  fp2,
  add,
  sub,
  mul,
  sqr,
  neg,
  div,
  inv,
  eq,
  isZero,
  pow,
  sqrt,
  randFp2,
} from './fp2';

export interface Curve {
  readonly a: Fp2;
  readonly b: Fp2;
}

/** Affine point, or null for the point at infinity. */
export type Pt = { readonly x: Fp2; readonly y: Fp2 } | null;

const J1728 = fp2(1728); // ≡ 4 (mod 431)

/**
 * A curve with the given j-invariant: for j ∉ {0, 1728},
 * E_j : y² = x³ + 3m·x + 2m with m = j/(1728 − j); plus the standard models
 * y² = x³ + 1 (j = 0) and y² = x³ + x (j = 1728).
 */
export const curveFromJ = (j: Fp2): Curve => {
  if (isZero(j)) return { a: ZERO, b: ONE };
  if (eq(j, J1728)) return { a: ONE, b: ZERO };
  const m = div(j, sub(J1728, j));
  return { a: mul(fp2(3), m), b: mul(fp2(2), m) };
};

export const jInvariant = (c: Curve): Fp2 => {
  const a3 = mul(fp2(4), pow(c.a, 3));
  const denom = add(a3, mul(fp2(27), sqr(c.b)));
  return mul(fp2(1728), div(a3, denom));
};

export const discriminantNonzero = (c: Curve): boolean =>
  !isZero(add(mul(fp2(4), pow(c.a, 3)), mul(fp2(27), sqr(c.b))));

export const onCurve = (c: Curve, pt: Pt): boolean => {
  if (pt === null) return true;
  const lhs = sqr(pt.y);
  const rhs = add(add(pow(pt.x, 3), mul(c.a, pt.x)), c.b);
  return eq(lhs, rhs);
};

export const ptEq = (p1: Pt, p2: Pt): boolean => {
  if (p1 === null || p2 === null) return p1 === p2;
  return eq(p1.x, p2.x) && eq(p1.y, p2.y);
};

export const ptNeg = (pt: Pt): Pt => (pt === null ? null : { x: pt.x, y: neg(pt.y) });

export const ptAdd = (c: Curve, p1: Pt, p2: Pt): Pt => {
  if (p1 === null) return p2;
  if (p2 === null) return p1;
  if (eq(p1.x, p2.x)) {
    if (!eq(p1.y, p2.y) || isZero(p1.y)) return null; // P + (−P) = O
    // doubling
    const lam = div(add(mul(fp2(3), sqr(p1.x)), c.a), mul(fp2(2), p1.y));
    const x3 = sub(sqr(lam), mul(fp2(2), p1.x));
    const y3 = sub(mul(lam, sub(p1.x, x3)), p1.y);
    return { x: x3, y: y3 };
  }
  const lam = div(sub(p2.y, p1.y), sub(p2.x, p1.x));
  const x3 = sub(sub(sqr(lam), p1.x), p2.x);
  const y3 = sub(mul(lam, sub(p1.x, x3)), p1.y);
  return { x: x3, y: y3 };
};

/** [n]P by double-and-add; n ≥ 0 (n ≤ (p+1)² fits exactly in a double). */
export const ptMul = (c: Curve, n: number, pt: Pt): Pt => {
  let r: Pt = null;
  let base = pt;
  let k = n;
  while (k > 0) {
    if (k % 2 === 1) r = ptAdd(c, r, base);
    base = ptAdd(c, base, base);
    k = Math.floor(k / 2);
  }
  return r;
};

/** A random affine point, by sampling x until x³ + ax + b is a square. */
export const randomPoint = (c: Curve, rng: () => number): Pt => {
  for (let i = 0; i < 5000; i++) {
    const x = randFp2(rng);
    const rhs = add(add(pow(x, 3), mul(c.a, x)), c.b);
    const y = sqrt(rhs);
    if (y !== null) return { x, y };
  }
  throw new Error('failed to sample a point (unreachable)');
};

/**
 * Probabilistic supersingularity check over GF(p²): E is supersingular iff
 * its Frobenius trace t lies in {0, ±p, ±2p}, i.e. #E(GF(p²)) = p² + 1 − t
 * for one of those five values. We find the t whose group order kills
 * `samples` random points; an ordinary curve's trace is outside the set, so
 * no candidate order annihilates its points except with tiny probability.
 * Returns the matching trace, or null (⇒ ordinary).
 */
export const supersingularTrace = (
  c: Curve,
  rng: () => number,
  samples = 8,
): number | null => {
  const candidates = [2 * P, -2 * P, P, -P, 0];
  const pts: Pt[] = Array.from({ length: samples }, () => randomPoint(c, rng));
  for (const t of candidates) {
    const order = Q + 1 - t;
    if (pts.every((pt) => ptMul(c, order, pt) === null)) return t;
  }
  return null;
};

/**
 * Deterministic check for j ∈ GF(p): count #E(GF(p)) by scanning all x.
 * A curve over GF(p) is supersingular iff #E(GF(p)) = p + 1 (trace 0),
 * and this holds for a twist-independent reason: twisting negates the trace.
 */
export const countPointsFp = (c: Curve): number => {
  if (!isZero(c.a) && c.a.b !== 0) throw new Error('curve not defined over GF(p)');
  if (!isZero(c.b) && c.b.b !== 0) throw new Error('curve not defined over GF(p)');
  const legendre = (v: number): number => {
    const m = ((v % P) + P) % P;
    if (m === 0) return 0;
    let r = 1;
    let base = m;
    let e = (P - 1) / 2;
    while (e > 0) {
      if (e & 1) r = (r * base) % P;
      base = (base * base) % P;
      e >>= 1;
    }
    return r === 1 ? 1 : -1;
  };
  let count = 1; // point at infinity
  for (let x = 0; x < P; x++) {
    const rhs = (((x * x) % P) * x + c.a.a * x + c.b.a) % P;
    count += 1 + legendre(rhs);
  }
  return count;
};

/** Convenience: exact inverse in GF(p²) is re-exported for UI use. */
export { inv as fp2Inv };
