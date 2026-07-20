/**
 * Dense univariate polynomials over GF(p²), used to find the roots of the
 * specialized modular polynomial Φ_ℓ(j, Y) — i.e. the ℓ-isogeny neighbors
 * of a vertex j in the supersingular graph.
 *
 * Root-finding is real algebra, not table lookup: square-free reduction,
 * then gcd(Y^q − Y, f) to isolate the split part, then Cantor–Zassenhaus
 * equal-degree splitting with a *seeded* PRNG so every build of the graph
 * is reproducible. Multiplicities are recovered by exact trial division.
 */

import {
  type Fp2,
  P,
  Q,
  ZERO,
  ONE,
  add,
  sub,
  mul,
  neg,
  inv,
  eq,
  isZero,
  key,
  randFp2,
} from './fp2';

/** Coefficient list, index = power. Invariant: trimmed (no leading zeros). */
export type Poly = Fp2[];

export const trim = (f: Poly): Poly => {
  let d = f.length - 1;
  while (d >= 0 && isZero(f[d])) d--;
  return f.slice(0, d + 1);
};

export const deg = (f: Poly): number => f.length - 1; // deg(0) = −1
export const polyIsZero = (f: Poly): boolean => f.length === 0;

export const constPoly = (c: Fp2): Poly => trim([c]);
export const X: Poly = [ZERO, ONE];

export const polyEq = (f: Poly, g: Poly): boolean =>
  f.length === g.length && f.every((c, i) => eq(c, g[i]));

export const evalAt = (f: Poly, x: Fp2): Fp2 => {
  let acc = ZERO;
  for (let i = f.length - 1; i >= 0; i--) acc = add(mul(acc, x), f[i]);
  return acc;
};

export const polyAdd = (f: Poly, g: Poly): Poly => {
  const out: Fp2[] = [];
  for (let i = 0; i < Math.max(f.length, g.length); i++)
    out.push(add(f[i] ?? ZERO, g[i] ?? ZERO));
  return trim(out);
};

export const polySub = (f: Poly, g: Poly): Poly => {
  const out: Fp2[] = [];
  for (let i = 0; i < Math.max(f.length, g.length); i++)
    out.push(sub(f[i] ?? ZERO, g[i] ?? ZERO));
  return trim(out);
};

export const polyMul = (f: Poly, g: Poly): Poly => {
  if (polyIsZero(f) || polyIsZero(g)) return [];
  const out: Fp2[] = Array.from({ length: f.length + g.length - 1 }, () => ZERO);
  for (let i = 0; i < f.length; i++)
    for (let j = 0; j < g.length; j++)
      out[i + j] = add(out[i + j], mul(f[i], g[j]));
  return trim(out);
};

export const scale = (f: Poly, c: Fp2): Poly =>
  isZero(c) ? [] : trim(f.map((x) => mul(x, c)));

/** Euclidean division f = q·g + r with deg r < deg g. */
export const divmod = (f: Poly, g: Poly): { q: Poly; r: Poly } => {
  if (polyIsZero(g)) throw new Error('polynomial division by zero');
  const linv = inv(g[g.length - 1]);
  let r = [...f];
  const q: Fp2[] = Array.from({ length: Math.max(0, f.length - g.length + 1) }, () => ZERO);
  while (r.length >= g.length && !polyIsZero(trim(r))) {
    r = trim(r);
    if (r.length < g.length) break;
    const shift = r.length - g.length;
    const c = mul(r[r.length - 1], linv);
    q[shift] = c;
    for (let i = 0; i < g.length; i++)
      r[shift + i] = sub(r[shift + i], mul(c, g[i]));
    r = r.slice(0, r.length - 1);
  }
  return { q: trim(q), r: trim(r) };
};

export const polyMod = (f: Poly, g: Poly): Poly => divmod(f, g).r;

export const monic = (f: Poly): Poly =>
  polyIsZero(f) ? f : scale(f, inv(f[f.length - 1]));

export const gcd = (f: Poly, g: Poly): Poly => {
  let a = trim(f);
  let b = trim(g);
  while (!polyIsZero(b)) {
    const r = polyMod(a, b);
    a = b;
    b = r;
  }
  return monic(a);
};

export const deriv = (f: Poly): Poly =>
  trim(f.slice(1).map((c, i) => {
    const k = (i + 1) % P; // char p — exact since coefficients are mod p
    let acc = ZERO;
    for (let t = 0; t < k; t++) acc = add(acc, c);
    return acc;
  }));

/** base^e mod m by square-and-multiply (e ≥ 0, plain number exponent). */
export const powmod = (base: Poly, e: number, m: Poly): Poly => {
  let r = constPoly(ONE);
  let b = polyMod(base, m);
  let k = e;
  while (k > 0) {
    if (k % 2 === 1) r = polyMod(polyMul(r, b), m);
    b = polyMod(polyMul(b, b), m);
    k = Math.floor(k / 2);
  }
  return r;
};

const rootOfLinear = (f: Poly): Fp2 => mul(neg(f[0]), inv(f[1]));

/**
 * Cantor–Zassenhaus: split a monic square-free product of distinct linear
 * factors into its roots. Recursion on gcd((Y+α)^((q−1)/2) − 1, h).
 */
const splitRoots = (h: Poly, rng: () => number, out: Fp2[]): void => {
  if (deg(h) <= 0) return;
  if (deg(h) === 1) {
    out.push(rootOfLinear(h));
    return;
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    const alpha = randFp2(rng);
    const shifted: Poly = trim([alpha, ONE]); // Y + α
    const w = powmod(shifted, (Q - 1) / 2, h);
    const d = gcd(polySub(w, constPoly(ONE)), h);
    if (deg(d) > 0 && deg(d) < deg(h)) {
      splitRoots(d, rng, out);
      splitRoots(divmod(h, d).q, rng, out);
      return;
    }
  }
  throw new Error('Cantor–Zassenhaus failed to split (should be unreachable)');
};

/**
 * All roots of f in GF(p²), with multiplicities.
 * Returns a map from element key to multiplicity.
 */
export const roots = (f: Poly, rng: () => number): Map<string, number> => {
  const out = new Map<string, number>();
  const ft = trim(f);
  if (deg(ft) <= 0) return out;
  // Square-free part, then keep only the factors that split over GF(p²):
  // gcd(Y^q − Y, g) is the product of the distinct linear factors.
  const g = monic(divmod(ft, gcd(ft, deriv(ft))).q);
  const yq = powmod(X, Q, g);
  const split = gcd(polySub(yq, X), g);
  const distinct: Fp2[] = [];
  splitRoots(split, rng, distinct);
  // Recover multiplicities by exact repeated division of the original f.
  for (const r of distinct) {
    let m = 0;
    let cur = ft;
    for (;;) {
      const { q, r: rem } = divmod(cur, trim([neg(r), ONE]));
      if (!polyIsZero(rem)) break;
      m++;
      cur = q;
    }
    if (m > 0) out.set(key(r), m);
  }
  return out;
};

/** Brute-force roots by scanning all q elements — test oracle only. */
export const bruteRoots = (f: Poly): Map<string, number> => {
  const out = new Map<string, number>();
  for (let a = 0; a < P; a++) {
    for (let b = 0; b < P; b++) {
      const x: Fp2 = { a, b };
      if (isZero(evalAt(f, x))) {
        // multiplicity via trial division
        let m = 0;
        let cur = trim(f);
        for (;;) {
          const { q, r } = divmod(cur, trim([neg(x), ONE]));
          if (!polyIsZero(r)) break;
          m++;
          cur = q;
        }
        out.set(key(x), m);
      }
    }
  }
  return out;
};
