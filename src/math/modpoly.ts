/**
 * The classical modular polynomials Φ₂(X, Y) and Φ₃(X, Y), with their exact
 * integer coefficients (BigInt). Φ_ℓ(j, j′) = 0 exactly when there is a
 * cyclic ℓ-isogeny between curves with j-invariants j and j′ — these two
 * polynomials ARE the edge relation of the 2- and 3-isogeny graphs.
 *
 * The coefficients are classical (Fricke; tabulated in e.g. Sutherland's
 * modular polynomial database). They are verified in tests against
 * characteristic-0 CM known-answer facts such as Φ₂(1728, 66³) = 0 and the
 * mod-p structure of the supersingular graph (37 vertices, (ℓ+1)-regularity,
 * the Eichler mass formula).
 */

import { type Fp2, P, ZERO, add, mul, fp2, pow } from './fp2';
import { type Poly, trim } from './poly';

/** Term list: [degX, degY, coefficient]. Every term is listed explicitly. */
export type PhiTable = ReadonlyArray<readonly [number, number, bigint]>;

export const PHI2: PhiTable = [
  [3, 0, 1n],
  [0, 3, 1n],
  [2, 2, -1n],
  [2, 1, 1488n],
  [1, 2, 1488n],
  [2, 0, -162000n],
  [0, 2, -162000n],
  [1, 1, 40773375n],
  [1, 0, 8748000000n],
  [0, 1, 8748000000n],
  [0, 0, -157464000000000n],
];

export const PHI3: PhiTable = [
  [4, 0, 1n],
  [0, 4, 1n],
  [3, 3, -1n],
  [3, 2, 2232n],
  [2, 3, 2232n],
  [3, 1, -1069956n],
  [1, 3, -1069956n],
  [3, 0, 36864000n],
  [0, 3, 36864000n],
  [2, 2, 2587918086n],
  [2, 1, 8900222976000n],
  [1, 2, 8900222976000n],
  [2, 0, 452984832000000n],
  [0, 2, 452984832000000n],
  [1, 1, -770845966336000000n],
  [1, 0, 1855425871872000000000n],
  [0, 1, 1855425871872000000000n],
];

export const phiTable = (ell: 2 | 3): PhiTable => (ell === 2 ? PHI2 : PHI3);

/** Exact integer evaluation — used for characteristic-0 CM known-answer tests. */
export const phiEvalInt = (table: PhiTable, x: bigint, y: bigint): bigint => {
  let acc = 0n;
  for (const [dx, dy, c] of table) acc += c * x ** BigInt(dx) * y ** BigInt(dy);
  return acc;
};

const BP = BigInt(P);
/** Reduce a signed integer coefficient into GF(p). */
export const coefModP = (c: bigint): number => Number(((c % BP) + BP) % BP);

/** Evaluate Φ over GF(p²). */
export const phiEvalFp2 = (table: PhiTable, x: Fp2, y: Fp2): Fp2 => {
  let acc = ZERO;
  for (const [dx, dy, c] of table) {
    const term = mul(fp2(coefModP(c)), mul(pow(x, dx), pow(y, dy)));
    acc = add(acc, term);
  }
  return acc;
};

/**
 * Specialize Φ_ℓ(j, Y) to a univariate polynomial in Y over GF(p²).
 * Its roots (with multiplicity) are exactly the ℓ-isogeny neighbors of j.
 */
export const phiSpecialize = (table: PhiTable, j: Fp2): Poly => {
  const maxDegY = Math.max(...table.map(([, dy]) => dy));
  const out: Fp2[] = Array.from({ length: maxDegY + 1 }, () => ZERO);
  for (const [dx, dy, c] of table) {
    const term = mul(fp2(coefModP(c)), pow(j, dx));
    out[dy] = add(out[dy], term);
  }
  return trim(out);
};
