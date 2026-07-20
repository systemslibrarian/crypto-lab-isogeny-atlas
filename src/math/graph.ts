/**
 * The supersingular isogeny atlas over GF(431²), computed — not drawn.
 *
 * Starting from the known supersingular j-invariant 1728 (supersingular
 * because p ≡ 3 mod 4), we discover every vertex by breadth-first search:
 * the ℓ-isogeny neighbors of j are the roots of Φ_ℓ(j, Y) in GF(p²), found
 * with real polynomial factorization (Cantor–Zassenhaus). The ℓ-isogeny
 * graph on supersingular curves is connected (Mestre / Pizer — these graphs
 * are Ramanujan), so BFS finds the whole atlas: all ⌊p/12⌋ + 2 = 37 curves.
 */

import { type Fp2, P, fp2, conj, key, inFp, eq, isZero, makeRng } from './fp2';
import { roots } from './poly';
import { phiSpecialize, phiTable } from './modpoly';

export interface Edge {
  readonly to: number;
  readonly mult: number;
}

export interface Atlas {
  readonly p: number;
  /** Canonically ordered vertices (sorted by (b, a) of a + bi). */
  readonly nodes: readonly Fp2[];
  readonly index: ReadonlyMap<string, number>;
  /** adj[ℓ][v] = ℓ-isogeny neighbors of v with multiplicities. */
  readonly adj2: ReadonlyArray<readonly Edge[]>;
  readonly adj3: ReadonlyArray<readonly Edge[]>;
  /** Vertices with j ∈ GF(p) — the "GF(p) spine" where CSIDH-style group actions live. */
  readonly spine: readonly boolean[];
  /** conjIndex[v] = index of the Galois-conjugate vertex (Frobenius pairing). */
  readonly conjIndex: readonly number[];
  /** |Aut(E_j)| over GF(p̄): 6 for j=0, 4 for j=1728, else 2 (char ≠ 2,3). */
  readonly autOrder: readonly number[];
  /** Milliseconds spent computing (for the honest "computed live" status line). */
  readonly buildMs: number;
}

const J1728 = fp2(1728);

const nodeSortKey = (j: Fp2): number => j.b * P + j.a;

/** ℓ-isogeny neighbor multiset of j, via real root-finding of Φ_ℓ(j, Y). */
export const neighborsOf = (
  j: Fp2,
  ell: 2 | 3,
  rng: () => number,
): Map<string, number> => roots(phiSpecialize(phiTable(ell), j), rng);

export const buildAtlas = (): Atlas => {
  const t0 = performance.now();
  const rng = makeRng(0x1731431); // fixed seed: reproducible builds
  // Phase 1 — discover the vertex set by BFS in the 2-isogeny graph.
  const found = new Map<string, Fp2>();
  const queue: Fp2[] = [J1728];
  found.set(key(J1728), J1728);
  while (queue.length > 0) {
    const j = queue.shift() as Fp2;
    for (const k of neighborsOf(j, 2, rng).keys()) {
      if (!found.has(k)) {
        const [a, b] = k.split(',').map(Number);
        const nj = fp2(a, b);
        found.set(k, nj);
        queue.push(nj);
      }
    }
  }
  // Canonical vertex order.
  const nodes = [...found.values()].sort((x, y) => nodeSortKey(x) - nodeSortKey(y));
  const index = new Map<string, number>(nodes.map((j, i) => [key(j), i]));
  // Phase 2 — adjacency (with multiplicities) for ℓ = 2 and ℓ = 3.
  const buildAdj = (ell: 2 | 3): Edge[][] =>
    nodes.map((j) => {
      const edges: Edge[] = [];
      for (const [k, mult] of neighborsOf(j, ell, rng)) {
        const to = index.get(k);
        if (to === undefined)
          throw new Error(
            `Φ_${ell} produced a neighbor outside the supersingular set — impossible if the coefficients are right`,
          );
        edges.push({ to, mult });
      }
      return edges.sort((e1, e2) => e1.to - e2.to);
    });
  const adj2 = buildAdj(2);
  const adj3 = buildAdj(3);
  const spine = nodes.map(inFp);
  const conjIndex = nodes.map((j) => {
    const ci = index.get(key(conj(j)));
    if (ci === undefined) throw new Error('supersingular set is not Galois-stable?');
    return ci;
  });
  const autOrder = nodes.map((j) => (isZero(j) ? 6 : eq(j, J1728) ? 4 : 2));
  return {
    p: P,
    nodes,
    index,
    adj2,
    adj3,
    spine,
    conjIndex,
    autOrder,
    buildMs: performance.now() - t0,
  };
};

export const adjOf = (atlas: Atlas, ell: 2 | 3): ReadonlyArray<readonly Edge[]> =>
  ell === 2 ? atlas.adj2 : atlas.adj3;

/** Out-degree counting multiplicity — the theorem says this is always ℓ + 1. */
export const outDegree = (edges: readonly Edge[]): number =>
  edges.reduce((s, e) => s + e.mult, 0);

/** Undirected edge count for the status line (loops count once). */
export const edgeCount = (adj: ReadonlyArray<readonly Edge[]>): number => {
  let n = 0;
  adj.forEach((edges, v) => {
    for (const e of edges) if (e.to >= v) n++;
  });
  return n;
};

/**
 * Eichler mass formula check: Σ_j 1/|Aut(E_j)| = (p − 1)/24.
 * Returned as an exact integer identity: Σ_j 24/|Aut(E_j)| = p − 1
 * (each term is an integer since |Aut| ∈ {2, 4, 6}).
 */
export const massFormulaHolds = (atlas: Atlas): boolean =>
  atlas.autOrder.reduce((s, a) => s + 24 / a, 0) === atlas.p - 1;

/** Connectivity of one ℓ-graph (BFS over the finished adjacency). */
export const isConnected = (adj: ReadonlyArray<readonly Edge[]>): boolean => {
  if (adj.length === 0) return true;
  const seen = new Set<number>([0]);
  const stack = [0];
  while (stack.length > 0) {
    const v = stack.pop() as number;
    for (const e of adj[v])
      if (!seen.has(e.to)) {
        seen.add(e.to);
        stack.push(e.to);
      }
  }
  return seen.size === adj.length;
};
