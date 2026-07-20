/**
 * Exact arithmetic in GF(p) and GF(p²) for p = 431.
 *
 * p ≡ 3 (mod 4), so GF(p²) = GF(p)(i) with i² = −1. Every element is
 * a + b·i with a, b ∈ [0, p). All products fit comfortably in a JS double
 * (430² < 2^18), so plain numbers are exact — no BigInt needed here.
 *
 * p = 431 is chosen because it is the classic teaching prime for
 * supersingular isogeny graphs: p ≡ 3 (mod 4) makes j = 1728 supersingular,
 * p ≡ 2 (mod 3) makes j = 0 supersingular, and the graph has
 * ⌊p/12⌋ + 2 = 37 vertices — big enough to be interesting, small enough
 * to draw every node.
 */

export const P = 431;
export const Q = P * P; // |GF(p²)| = 185 761

export interface Fp2 {
  readonly a: number; // coefficient of 1
  readonly b: number; // coefficient of i
}

const modp = (x: number): number => ((x % P) + P) % P;

export const fp2 = (a: number, b = 0): Fp2 => ({ a: modp(a), b: modp(b) });

export const ZERO: Fp2 = fp2(0);
export const ONE: Fp2 = fp2(1);

export const eq = (x: Fp2, y: Fp2): boolean => x.a === y.a && x.b === y.b;
export const isZero = (x: Fp2): boolean => x.a === 0 && x.b === 0;
export const inFp = (x: Fp2): boolean => x.b === 0;

/** Stable string key for use in Maps/Sets. */
export const key = (x: Fp2): string => `${x.a},${x.b}`;
export const fromKey = (k: string): Fp2 => {
  const [a, b] = k.split(',').map(Number);
  return fp2(a, b);
};

export const add = (x: Fp2, y: Fp2): Fp2 => fp2(x.a + y.a, x.b + y.b);
export const sub = (x: Fp2, y: Fp2): Fp2 => fp2(x.a - y.a, x.b - y.b);
export const neg = (x: Fp2): Fp2 => fp2(-x.a, -x.b);

/** (a + bi)(c + di) = (ac − bd) + (ad + bc)i */
export const mul = (x: Fp2, y: Fp2): Fp2 =>
  fp2(x.a * y.a - x.b * y.b, x.a * y.b + x.b * y.a);

export const sqr = (x: Fp2): Fp2 => mul(x, x);

/** Galois conjugate a − bi; this is also the p-power Frobenius on GF(p²). */
export const conj = (x: Fp2): Fp2 => fp2(x.a, -x.b);

/** Frobenius x ↦ x^p. For p ≡ 3 (mod 4), i^p = −i, so this is conjugation. */
export const frob = conj;

/** Norm to GF(p): N(a + bi) = a² + b². */
export const norm = (x: Fp2): number => modp(x.a * x.a + x.b * x.b);

const powFp = (base: number, e: number): number => {
  let r = 1;
  let b = modp(base);
  let k = e;
  while (k > 0) {
    if (k & 1) r = (r * b) % P;
    b = (b * b) % P;
    k >>>= 1;
  }
  return r;
};

const invFp = (x: number): number => {
  if (modp(x) === 0) throw new Error('division by zero in GF(p)');
  return powFp(x, P - 2);
};

export const inv = (x: Fp2): Fp2 => {
  const n = norm(x);
  if (n === 0) throw new Error('division by zero in GF(p²)');
  const ninv = invFp(n);
  return fp2(x.a * ninv, -x.b * ninv);
};

export const div = (x: Fp2, y: Fp2): Fp2 => mul(x, inv(y));

/** x^e for e ≥ 0 (square-and-multiply). */
export const pow = (x: Fp2, e: number): Fp2 => {
  let r = ONE;
  let b = x;
  let k = e;
  while (k > 0) {
    if (k & 1) r = mul(r, b);
    b = sqr(b);
    k = Math.floor(k / 2);
  }
  return r;
};

/** Euler test in GF(p): is x a nonzero square mod p? */
const isSquareFp = (x: number): boolean => powFp(x, (P - 1) / 2) === 1;

/** sqrt in GF(p) for p ≡ 3 (mod 4): x^((p+1)/4). Returns null if x is not a QR. */
const sqrtFp = (x: number): number | null => {
  const v = modp(x);
  if (v === 0) return 0;
  if (!isSquareFp(v)) return null;
  return powFp(v, (P + 1) / 4);
};

/**
 * Square root in GF(p²) via the norm trick for GF(p)(i), i² = −1:
 * for x = a + bi, N(x) = a² + b². If s = √N(x) exists in GF(p), then a
 * square root u + vi satisfies u² = (a + s)/2 (or (a − s)/2) and v = b/(2u).
 * Every result is verified by squaring; returns null for non-squares.
 */
export const sqrt = (x: Fp2): Fp2 | null => {
  if (isZero(x)) return ZERO;
  if (x.b === 0) {
    const r = sqrtFp(x.a);
    if (r !== null) return fp2(r);
    // a is a non-square in GF(p); then −a is a square and (ri)² = −r² = a.
    const r2 = sqrtFp(modp(-x.a));
    if (r2 === null) return null; // unreachable for p ≡ 3 (mod 4)
    const cand = fp2(0, r2);
    return eq(sqr(cand), x) ? cand : null;
  }
  const s = sqrtFp(norm(x));
  if (s === null) return null; // non-square norm ⇒ x is a non-square in GF(p²)
  const half = invFp(2);
  for (const sign of [s, modp(-s)]) {
    const t = modp((x.a + sign) * half);
    const u = sqrtFp(t);
    if (u === null || u === 0) continue;
    const v = modp(x.b * invFp(2 * u));
    const cand = fp2(u, v);
    if (eq(sqr(cand), x)) return cand;
  }
  return null;
};

/** Pretty-printer: "0", "17", "5i", "17 + 5i", "17 − 5i" (small-half display). */
export const show = (x: Fp2): string => {
  if (x.b === 0) return `${x.a}`;
  const bPos = x.b <= P / 2;
  const bMag = bPos ? x.b : P - x.b;
  const iPart = `${bMag === 1 ? '' : bMag}i`;
  if (x.a === 0) return bPos ? iPart : `−${iPart}`;
  return `${x.a} ${bPos ? '+' : '−'} ${iPart}`;
};

/** Deterministic xorshift32 PRNG — reproducible graph builds and tests. */
export const makeRng = (seed = 0x9e3779b9): (() => number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s;
  };
};

/** Uniform-ish random element of GF(p²). */
export const randFp2 = (rng: () => number): Fp2 => fp2(rng() % P, rng() % P);
