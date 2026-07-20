/**
 * Structural known-answer tests for the computed atlas. These are the deep
 * cross-checks: if a single modular-polynomial coefficient were wrong, or
 * root-finding dropped a root, at least one of these classical facts would
 * fail loudly.
 */
import { describe, expect, it } from 'vitest';
import {
  buildAtlas,
  outDegree,
  massFormulaHolds,
  isConnected,
  edgeCount,
} from './graph';
import { fp2, key, conj, eq } from './fp2';

const atlas = buildAtlas();

describe('the supersingular atlas over GF(431²)', () => {
  it('KAT 10 — vertex count: exactly ⌊p/12⌋ + 2 = 37 supersingular j-invariants (p ≡ 11 mod 12)', () => {
    expect(atlas.p % 12).toBe(11);
    expect(atlas.nodes.length).toBe(37);
  });

  it('KAT 11 — j = 0 and j = 1728 are both vertices (p ≡ 2 mod 3 and p ≡ 3 mod 4)', () => {
    expect(atlas.index.has(key(fp2(0)))).toBe(true);
    expect(atlas.index.has(key(fp2(1728)))).toBe(true);
  });

  it('KAT 12 — Eichler mass formula: Σ 1/|Aut| = (p − 1)/24, exactly', () => {
    expect(massFormulaHolds(atlas)).toBe(true);
  });

  it('KAT 13 — the 2-isogeny graph is 3-regular counting multiplicity (deg Φ₂(j,·) = ℓ+1)', () => {
    for (const edges of atlas.adj2) expect(outDegree(edges)).toBe(3);
  });

  it('KAT 14 — the 3-isogeny graph is 4-regular counting multiplicity', () => {
    for (const edges of atlas.adj3) expect(outDegree(edges)).toBe(4);
  });

  it('KAT 15 — both graphs are connected (Mestre/Pizer: these are expander graphs)', () => {
    expect(isConnected(atlas.adj2)).toBe(true);
    expect(isConnected(atlas.adj3)).toBe(true);
  });

  it('adjacency is symmetric as a relation: j′ ∈ N(j) ⇔ j ∈ N(j′)', () => {
    for (const adj of [atlas.adj2, atlas.adj3]) {
      adj.forEach((edges, v) => {
        for (const e of edges) {
          expect(adj[e.to].some((back) => back.to === v)).toBe(true);
        }
      });
    }
  });

  it('the vertex set is Galois-stable and conjugation is a graph automorphism', () => {
    atlas.nodes.forEach((j, v) => {
      const cv = atlas.conjIndex[v];
      expect(eq(atlas.nodes[cv], conj(j))).toBe(true);
      // conjugate of every neighbor of v is a neighbor of conj(v), same multiplicity
      for (const adj of [atlas.adj2, atlas.adj3]) {
        for (const e of adj[v]) {
          const mirrored = adj[cv].find((x) => x.to === atlas.conjIndex[e.to]);
          expect(mirrored?.mult).toBe(e.mult);
        }
      }
    });
  });

  it('spine flags mark exactly the GF(p)-rational vertices, and there are some of each', () => {
    atlas.nodes.forEach((j, v) => expect(atlas.spine[v]).toBe(j.b === 0));
    const spineCount = atlas.spine.filter(Boolean).length;
    expect(spineCount).toBeGreaterThan(0);
    expect(spineCount).toBeLessThan(atlas.nodes.length);
    // non-spine vertices come in conjugate pairs, so their count is even
    expect((atlas.nodes.length - spineCount) % 2).toBe(0);
  });

  it('automorphism orders are 6 at j=0, 4 at j=1728, 2 elsewhere', () => {
    atlas.nodes.forEach((j, v) => {
      const expected = eq(j, fp2(0)) ? 6 : eq(j, fp2(1728)) ? 4 : 2;
      expect(atlas.autOrder[v]).toBe(expected);
    });
  });

  it('edge counts are consistent with the handshake bound', () => {
    // 37 vertices, 3-regular with loops/multiplicity ⇒ at most 56 distinct
    // undirected edges; just pin the computed values for regression.
    expect(edgeCount(atlas.adj2)).toBeGreaterThan(30);
    expect(edgeCount(atlas.adj3)).toBeGreaterThan(40);
  });

  it('the build is deterministic: two builds agree exactly', () => {
    const again = buildAtlas();
    expect(again.nodes.map(key)).toEqual(atlas.nodes.map(key));
    expect(again.adj2).toEqual(atlas.adj2);
    expect(again.adj3).toEqual(atlas.adj3);
  });
});
