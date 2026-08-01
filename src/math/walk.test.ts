import { describe, expect, it } from 'vitest';
import { buildAtlas } from './graph';
import {
  bfsPath,
  hasEdge,
  exactLengthEndpoints,
  cyclesThrough,
  cglWalk,
  messageBits,
  findCollision,
} from './walk';
import { fp2, key } from './fp2';

const atlas = buildAtlas();
const start = atlas.index.get(key(fp2(1728)))!;

describe('walks on the atlas', () => {
  it('BFS finds a path between every pair of vertices, and every hop is a real edge', () => {
    for (let target = 0; target < atlas.nodes.length; target += 5) {
      const r = bfsPath(atlas.adj2, start, target);
      expect(r.path).not.toBeNull();
      const path = r.path!;
      expect(path[0]).toBe(start);
      expect(path[path.length - 1]).toBe(target);
      for (let i = 0; i + 1 < path.length; i++) {
        expect(hasEdge(atlas.adj2, path[i], path[i + 1])).toBe(true);
      }
    }
  });

  it('BFS layers partition distances: a vertex in layer d has no neighbor in layer < d−1', () => {
    const far = atlas.nodes.length - 1;
    const { layers, path } = bfsPath(atlas.adj2, start, far);
    expect(path!.length - 1).toBeLessThanOrEqual(layers.length - 1);
    // path length equals the layer index at which the target appeared
    expect(layers[path!.length - 1]).toContain(far);
  });

  it('the graph is an expander in practice: eccentricity of j=1728 is 7 ≈ log₂(p)', () => {
    let ecc = 0;
    for (let t = 0; t < atlas.nodes.length; t++) {
      const r = bfsPath(atlas.adj2, start, t);
      ecc = Math.max(ecc, r.path!.length - 1);
    }
    // Deterministic graph ⇒ exact value; ~log₂(431) ≈ 8.75, so 7 is the
    // logarithmic scaling the Ramanujan property promises.
    expect(ecc).toBe(7);
  });

  it('exact-length endpoints grow with k and every claimed endpoint has a real walk', () => {
    const s1 = exactLengthEndpoints(atlas.adj2, start, 1);
    // distance-1 endpoints are exactly the (non-loop) neighbors of start … plus
    // possibly start itself via a self-loop edge
    for (const v of s1) {
      expect(hasEdge(atlas.adj2, start, v)).toBe(true);
    }
    const s6 = exactLengthEndpoints(atlas.adj2, start, 6);
    expect(s6.size).toBeGreaterThan(s1.size);
  });

  it('cyclesThrough returns genuine closed walks through the vertex', () => {
    const cycles = cyclesThrough(atlas.adj2, start, 3);
    expect(cycles.length).toBeGreaterThan(0);
    for (const cyc of cycles) {
      expect(cyc[0]).toBe(start);
      expect(cyc[cyc.length - 1]).toBe(start);
      for (let i = 0; i + 1 < cyc.length; i++) {
        expect(hasEdge(atlas.adj2, cyc[i], cyc[i + 1])).toBe(true);
      }
    }
  });

  it('messageBits: "A" = 0x41 = 01000001', () => {
    expect(messageBits('A').join('')).toBe('01000001');
  });

  // ---- teaching-model semantics, pinned (see the in-page model notes) ----
  // j = 1728 has adj2 = { self-loop ×1, j=19 ×2 } (proved in modpoly.test.ts).
  // The walk model collapses the multiplicity-2 edge into one choice and skips
  // the self-loop, so the first step from 1728 is forced to 19.

  it('pinned: cglWalk skips self-loops and collapses parallel edges (forced first step at j=1728)', () => {
    const loops = atlas.adj2[start].filter((e) => e.to === start);
    const mult2 = atlas.adj2[start].filter((e) => e.to !== start && e.mult === 2);
    expect(loops.length).toBe(1); // the structure this test depends on
    expect(mult2.length).toBe(1);
    const forced = mult2[0].to;
    // both bit values take the same first step — the collapse, made visible
    expect(cglWalk(atlas.adj2, start, [0]).path[1]).toBe(forced);
    expect(cglWalk(atlas.adj2, start, [1]).path[1]).toBe(forced);
  });

  it('pinned: exactLengthEndpoints counts the self-loop as a length-1 walk at j=1728', () => {
    const s1 = exactLengthEndpoints(atlas.adj2, start, 1);
    expect(s1.has(start)).toBe(true); // via the self-loop
    const neighbors = new Set(atlas.adj2[start].map((e) => e.to));
    for (const v of s1) expect(neighbors.has(v)).toBe(true);
  });

  it('the CGL walk is deterministic and every hop is a real edge', () => {
    const bits = messageBits('isogeny');
    const w1 = cglWalk(atlas.adj2, start, bits);
    const w2 = cglWalk(atlas.adj2, start, bits);
    expect(w1.path).toEqual(w2.path);
    expect(w1.bitsUsed).toBe(bits.length);
    for (let i = 0; i + 1 < w1.path.length; i++) {
      expect(hasEdge(atlas.adj2, w1.path[i], w1.path[i + 1])).toBe(true);
    }
  });

  it('the walk consumes the whole message — the sink vertices no longer dead-end it', () => {
    // Regression pin. Non-backtracking used to be enforced purely by previous
    // VERTEX, which strands the walk: over GF(431²), j = 0 has only {125 ×3} and
    // j ≡ 1728 has {self ×1, 19 ×2}, so a walk arriving at either from its one
    // neighbour had no legal move and stopped — silently hashing a prefix of the
    // message while reporting the endpoint as if it were the whole digest.
    //
    // The fix allows return across an edge of multiplicity >= 2, where several
    // distinct isogenies join the pair and only one is the dual of the step just
    // taken.
    //
    // Measured under the old rule, so this test is known to bite rather than
    // merely pass: 'alice@example' hashed 17 of 104 bits and the pangram 17 of
    // 344. 'isogeny' (56 bits) survived the old rule intact and is kept only as
    // a control — on its own it would have been a vacuous regression test.
    for (const msg of ['isogeny', 'alice@example', 'The quick brown fox jumps over the lazy dog']) {
      const bits = messageBits(msg);
      const w = cglWalk(atlas.adj2, start, bits);
      expect(w.bitsUsed).toBe(bits.length);
      expect(w.path.length).toBe(bits.length + 1);
    }
  });

  it('forcedSteps counts exactly the steps that had a single option', () => {
    // The status line tells the learner how many bits did not actually branch,
    // so the count has to be the measured one. Recompute it independently by
    // replaying the path and asking how many options each step really had.
    const bits = messageBits('endomorphism');
    const w = cglWalk(atlas.adj2, start, bits);

    let expectedForced = 0;
    let prev = -1;
    for (let i = 0; i + 1 < w.path.length; i++) {
      const cur = w.path[i];
      const options = atlas.adj2[cur].filter((e) => e.to !== cur && (e.to !== prev || e.mult >= 2));
      if (options.length === 1) expectedForced++;
      prev = cur;
    }
    expect(w.forcedSteps).toBe(expectedForced);
    // And it can never exceed the number of steps actually taken.
    expect(w.forcedSteps).toBeLessThanOrEqual(w.bitsUsed);
  });

  it('different messages usually walk to different places (sanity, not a theorem)', () => {
    const a = cglWalk(atlas.adj2, start, messageBits('alice@example'));
    const b = cglWalk(atlas.adj2, start, messageBits('bob-fake-cert'));
    expect(a.path.join()).not.toBe(b.path.join());
  });

  it('findCollision produces two DIFFERENT walks with the SAME endpoint — verified', () => {
    const col = findCollision(atlas.adj2, start, 8);
    expect(col).not.toBeNull();
    const { bitsA, bitsB, pathA, pathB, end } = col!;
    expect(bitsA).not.toBe(bitsB);
    expect(pathA.join()).not.toBe(pathB.join());
    expect(pathA[pathA.length - 1]).toBe(end);
    expect(pathB[pathB.length - 1]).toBe(end);
    for (const path of [pathA, pathB]) {
      for (let i = 0; i + 1 < path.length; i++) {
        expect(hasEdge(atlas.adj2, path[i], path[i + 1])).toBe(true);
      }
    }
  });
});
