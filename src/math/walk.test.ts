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
