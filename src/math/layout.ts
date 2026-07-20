/**
 * Deterministic force-directed layout (Fruchterman–Reingold style) with a
 * seeded PRNG — the picture is stable across visits, and the positions are
 * presentation only: adjacency comes solely from the modular polynomials.
 */

import { makeRng } from './fp2';
import type { Atlas } from './graph';

export interface XY {
  readonly x: number;
  readonly y: number;
}

export const layoutAtlas = (atlas: Atlas, iterations = 350): XY[] => {
  const n = atlas.nodes.length;
  const rng = makeRng(0xa71a5);
  const jitter = () => (rng() % 1000) / 1000 - 0.5;
  // Start on a circle in canonical order, tiny jitter to break symmetry.
  const pos = atlas.nodes.map((_, i) => ({
    x: Math.cos((2 * Math.PI * i) / n) + jitter() * 0.01,
    y: Math.sin((2 * Math.PI * i) / n) + jitter() * 0.01,
  }));
  // Union of 2- and 3-adjacency drives the springs so both views look sane.
  const springs: Array<[number, number]> = [];
  for (let v = 0; v < n; v++) {
    for (const e of atlas.adj2[v]) if (e.to > v) springs.push([v, e.to]);
    for (const e of atlas.adj3[v]) if (e.to > v) springs.push([v, e.to]);
  }
  const area = 4;
  const k = Math.sqrt(area / n);
  for (let it = 0; it < iterations; it++) {
    const disp = pos.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        let d = Math.hypot(dx, dy);
        if (d < 1e-6) {
          dx = jitter() * 0.01;
          dy = jitter() * 0.01;
          d = Math.hypot(dx, dy);
        }
        const f = (k * k) / d;
        disp[i].x += (dx / d) * f;
        disp[i].y += (dy / d) * f;
        disp[j].x -= (dx / d) * f;
        disp[j].y -= (dy / d) * f;
      }
    }
    for (const [u, v] of springs) {
      let dx = pos[u].x - pos[v].x;
      let dy = pos[u].y - pos[v].y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const f = (d * d) / k;
      dx = (dx / d) * f;
      dy = (dy / d) * f;
      disp[u].x -= dx;
      disp[u].y -= dy;
      disp[v].x += dx;
      disp[v].y += dy;
    }
    const temp = 0.12 * (1 - it / iterations) + 0.005;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(disp[i].x, disp[i].y) || 1e-6;
      const step = Math.min(d, temp);
      pos[i].x += (disp[i].x / d) * step;
      pos[i].y += (disp[i].y / d) * step;
      // mild gravity toward the origin keeps the cloud compact
      pos[i].x *= 0.995;
      pos[i].y *= 0.995;
    }
  }
  // Normalize into [0, 1]² with padding.
  const xs = pos.map((p) => p.x);
  const ys = pos.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 0.07;
  return pos.map((p) => ({
    x: pad + ((p.x - minX) / (maxX - minX || 1)) * (1 - 2 * pad),
    y: pad + ((p.y - minY) / (maxY - minY || 1)) * (1 - 2 * pad),
  }));
};
