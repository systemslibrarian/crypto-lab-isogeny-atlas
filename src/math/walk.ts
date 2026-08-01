/**
 * Walks on the atlas: breadth-first path search (the "hard problem" made
 * visible), cycles through a vertex (endomorphisms), endpoints of fixed-length
 * non-backtracking walks (fixed-degree isogenies), and a toy
 * Charles–Goren–Lauter (CGL) hash walk driven by real message bits.
 *
 * Convention note (stated in the UI too): at multi-edges and at the two
 * extra-automorphism vertices (j = 0, j ≡ 1728) "non-backtracking" is subtle;
 * this atlas uses the standard teaching simplification of forbidding an
 * immediate return to the vertex you just left.
 */

import type { Edge } from './graph';

export interface BfsResult {
  /** layers[d] = vertices first reached at distance d (layers[0] = [start]). */
  readonly layers: readonly (readonly number[])[];
  /** Shortest path start..target inclusive, or null if unreachable. */
  readonly path: readonly number[] | null;
  /** Total vertices touched by the search before the target was found. */
  readonly visited: number;
}

export const bfsPath = (
  adj: ReadonlyArray<readonly Edge[]>,
  start: number,
  target: number,
): BfsResult => {
  const parent = new Map<number, number>([[start, -1]]);
  const layers: number[][] = [[start]];
  let visited = 1;
  if (start !== target) {
    outer: for (;;) {
      const prev = layers[layers.length - 1];
      const next: number[] = [];
      for (const v of prev) {
        for (const e of adj[v]) {
          if (!parent.has(e.to)) {
            parent.set(e.to, v);
            next.push(e.to);
            visited++;
            if (e.to === target) {
              layers.push(next);
              break outer;
            }
          }
        }
      }
      if (next.length === 0) return { layers, path: null, visited };
      layers.push(next);
    }
  }
  const path: number[] = [];
  for (let v = target; v !== -1; v = parent.get(v) as number) path.push(v);
  path.reverse();
  return { layers, path, visited };
};

/** Is (u, v) an edge (any multiplicity)? */
export const hasEdge = (
  adj: ReadonlyArray<readonly Edge[]>,
  u: number,
  v: number,
): boolean => adj[u].some((e) => e.to === v);

/**
 * Vertices reachable from `start` by a walk of length exactly k that never
 * immediately returns to the vertex it just left (≈ endpoints of cyclic
 * degree-ℓ^k isogenies). DP over states (current, previous).
 */
export const exactLengthEndpoints = (
  adj: ReadonlyArray<readonly Edge[]>,
  start: number,
  k: number,
): ReadonlySet<number> => {
  // state set of (cur, prev); prev = -1 initially
  let states = new Set<string>([`${start},-1`]);
  for (let step = 0; step < k; step++) {
    const next = new Set<string>();
    for (const s of states) {
      const [cur, prev] = s.split(',').map(Number);
      for (const e of adj[cur]) {
        if (e.to === prev && !(e.to === cur)) continue; // no immediate return
        next.add(`${e.to},${cur}`);
      }
    }
    states = next;
    if (states.size === 0) break;
  }
  const out = new Set<number>();
  for (const s of states) out.add(Number(s.split(',')[0]));
  return out;
};

/**
 * Short cycles through `v` (closed walks, no immediate backtracking):
 * these are honest pictures of endomorphisms — composing the isogenies along
 * a closed walk of length k gives an endomorphism of degree ℓ^k.
 * Self-loops (Φ_ℓ(j, j) = 0) count as length-1 cycles.
 * Returns up to `max` cycles as vertex paths v … v, shortest first.
 */
export const cyclesThrough = (
  adj: ReadonlyArray<readonly Edge[]>,
  v: number,
  max = 3,
  maxLen = 10,
): readonly (readonly number[])[] => {
  const out: number[][] = [];
  const seenSignature = new Set<string>();
  // Self-loop first.
  if (adj[v].some((e) => e.to === v)) out.push([v, v]);
  // BFS over (cur, prev) states, tracking the path (graph is tiny: fine).
  interface St {
    cur: number;
    prev: number;
    path: number[];
  }
  let frontier: St[] = [{ cur: v, prev: -1, path: [v] }];
  for (let len = 1; len <= maxLen && out.length < max; len++) {
    const next: St[] = [];
    for (const st of frontier) {
      for (const e of adj[st.cur]) {
        if (e.to === st.prev && e.to !== st.cur) continue;
        if (e.to === st.cur) continue; // self-loops handled above
        const path = [...st.path, e.to];
        if (e.to === v && path.length >= 4) {
          // canonicalize (direction-independent) to avoid duplicates
          const fwd = path.join('-');
          const rev = [...path].reverse().join('-');
          const sig = fwd < rev ? fwd : rev;
          if (!seenSignature.has(sig)) {
            seenSignature.add(sig);
            out.push(path);
            if (out.length >= max) break;
          }
        } else if (e.to !== v) {
          next.push({ cur: e.to, prev: st.cur, path });
        }
      }
      if (out.length >= max) break;
    }
    frontier = next;
  }
  return out;
};

/** Message → bit array (UTF-8 char codes, MSB first). Real bits, no mixing. */
export const messageBits = (msg: string): number[] => {
  const bytes = new TextEncoder().encode(msg);
  const bits: number[] = [];
  for (const byte of bytes)
    for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  return bits;
};

export interface CglResult {
  readonly path: readonly number[];
  readonly end: number;
  /** Bits consumed. Equals bits.length unless the walk ran out of moves. */
  readonly bitsUsed: number;
  /**
   * Steps where only one neighbor was available, so the bit did not actually
   * choose anything. The toy graph is small enough for this to happen; the page
   * reports it rather than presenting every bit as if it had branched.
   */
  readonly forcedSteps: number;
}

/**
 * The neighbors a hash step may move to, having arrived at `cur` from `prev`.
 *
 * Self-loops are skipped and parallel isogenies to the same neighbor collapse to
 * one vertex-level choice — the stated teaching model. Immediate return to
 * `prev` is forbidden, EXCEPT across an edge of multiplicity ≥ 2: several
 * distinct isogenies join that pair, only one of them is the dual of the step
 * just taken, so going back along a different one is a genuine non-backtracking
 * move. (This is the vertex-level model's closest approximation to CGL's
 * dual-isogeny rule.)
 *
 * That exception is load-bearing, not a nicety. Without it the walk dead-ends:
 * over GF(431²), j = 0 has adj₂ = {j = 125 ×3} and j ≡ 1728 has
 * {self ×1, j = 19 ×2}, so a walk arriving at either from its only neighbor had
 * no legal move at all and simply stopped — silently discarding the rest of the
 * message (72 of the 120 bits of the exhibit's own default message; 327 of 344
 * for a pangram) and stranding the "hash" on one of two sink vertices.
 */
const hashOptions = (
  edges: readonly Edge[],
  cur: number,
  prev: number,
): number[] =>
  edges.filter((e) => e.to !== cur && (e.to !== prev || e.mult >= 2)).map((e) => e.to);

/**
 * Toy CGL-style hash walk on the 2-isogeny graph: start at a fixed vertex,
 * and at each step let the next message bit choose among the neighbors reachable
 * under {@link hashOptions}, in canonical index order.
 * This is a genuine deterministic walk in the genuine graph — the same idea
 * as the Charles–Goren–Lauter hash, with a simplified edge-ordering
 * convention (the real construction fixes conventions via the kernel
 * subgroups; the security story is identical).
 */
export const cglWalk = (
  adj: ReadonlyArray<readonly Edge[]>,
  start: number,
  bits: readonly number[],
): CglResult => {
  const path = [start];
  let cur = start;
  let prev = -1;
  let used = 0;
  let forcedSteps = 0;
  for (const bit of bits) {
    const options = hashOptions(adj[cur], cur, prev);
    // No legal move: the walk stops and the caller is told how many bits it
    // actually consumed, so a truncated hash can never be reported as a whole one.
    if (options.length === 0) break;
    if (options.length === 1) forcedSteps++;
    const choice = options[bit % options.length];
    prev = cur;
    cur = choice;
    path.push(cur);
    used++;
  }
  return { path, end: cur, bitsUsed: used, forcedSteps };
};

export interface Collision {
  readonly bitsA: string;
  readonly bitsB: string;
  readonly pathA: readonly number[];
  readonly pathB: readonly number[];
  readonly end: number;
}

/**
 * Find a genuine collision in the toy hash by enumerating all walks of
 * length `len` (2^len bit strings — pigeonhole over ~37 vertices guarantees
 * one for len ≥ 6). Only feasible because the prime is tiny: that gap
 * between "trivial here" and "infeasible at 2^256" is the lesson.
 */
export const findCollision = (
  adj: ReadonlyArray<readonly Edge[]>,
  start: number,
  len = 8,
): Collision | null => {
  const seen = new Map<number, { bits: string; path: readonly number[] }>();
  for (let m = 0; m < 1 << len; m++) {
    const bits = Array.from({ length: len }, (_, i) => (m >> (len - 1 - i)) & 1);
    const walk = cglWalk(adj, start, bits);
    const bitStr = bits.join('');
    const prior = seen.get(walk.end);
    if (prior && prior.path.join() !== walk.path.join()) {
      return {
        bitsA: prior.bits,
        bitsB: bitStr,
        pathA: prior.path,
        pathB: walk.path,
        end: walk.end,
      };
    }
    if (!prior) seen.set(walk.end, { bits: bitStr, path: walk.path });
  }
  return null;
};
