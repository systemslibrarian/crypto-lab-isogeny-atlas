/**
 * SVG rendering of the atlas. Positions are cosmetic (seeded force layout);
 * adjacency is the mathematics. Accessibility contract: every vertex is a
 * focusable, labelled button; state is never conveyed by color alone —
 * shapes (square = spine), stroke weight, dash patterns and text labels
 * carry the same information.
 */

import { type Fp2, fp2, show, eq } from '../math/fp2';
import type { Atlas, Edge } from '../math/graph';
import { adjOf } from '../math/graph';
import type { XY } from '../math/layout';

const SVG_NS = 'http://www.w3.org/2000/svg';
const W = 720;
const H = 560;

const el = <K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string> = {},
): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

export class AtlasView {
  readonly atlas: Atlas;
  private readonly pos: readonly XY[];
  private ell: 2 | 3 = 2;
  private readonly edgeLayer: SVGGElement;
  private readonly nodeLayer: SVGGElement;
  private readonly nodeEls: SVGGElement[] = [];
  private edgeEls = new Map<string, SVGElement>();
  /** Called when a vertex is clicked or activated by keyboard. */
  onActivate: (v: number) => void = () => {};

  constructor(svg: SVGSVGElement, atlas: Atlas, pos: readonly XY[]) {
    this.atlas = atlas;
    this.pos = pos;
    this.edgeLayer = el('g');
    this.nodeLayer = el('g');
    svg.append(this.edgeLayer, this.nodeLayer);
    this.drawNodes();
    this.drawEdges();
  }

  private xy(v: number): { x: number; y: number } {
    return { x: this.pos[v].x * W, y: this.pos[v].y * H };
  }

  getEll(): 2 | 3 {
    return this.ell;
  }

  setEll(ell: 2 | 3): void {
    if (this.ell === ell) return;
    this.ell = ell;
    this.drawEdges();
  }

  private drawEdges(): void {
    this.edgeLayer.replaceChildren();
    this.edgeEls = new Map();
    const adj = adjOf(this.atlas, this.ell);
    adj.forEach((edges: readonly Edge[], v: number) => {
      for (const e of edges) {
        if (e.to < v) continue; // draw each undirected edge once (loops: e.to === v)
        const a = this.xy(v);
        const kkey = `${v}-${e.to}`;
        let shape: SVGElement;
        if (e.to === v) {
          shape = el('circle', {
            cx: `${a.x + 13}`,
            cy: `${a.y - 13}`,
            r: '10',
            class: 'edge',
            'stroke-width': `${1.4 + (e.mult - 1) * 1.6}`,
          });
        } else {
          const b = this.xy(e.to);
          shape = el('line', {
            x1: `${a.x}`,
            y1: `${a.y}`,
            x2: `${b.x}`,
            y2: `${b.y}`,
            class: 'edge',
            'stroke-width': `${1.4 + (e.mult - 1) * 1.6}`,
          });
        }
        const label =
          e.to === v
            ? `self-loop at j = ${show(this.atlas.nodes[v])}${e.mult > 1 ? ` (multiplicity ${e.mult})` : ''}`
            : `${this.ell}-isogeny between j = ${show(this.atlas.nodes[v])} and j = ${show(this.atlas.nodes[e.to])}${e.mult > 1 ? ` (multiplicity ${e.mult})` : ''}`;
        const t = el('title');
        t.textContent = label;
        shape.append(t);
        this.edgeLayer.append(shape);
        this.edgeEls.set(kkey, shape);
      }
    });
  }

  private drawNodes(): void {
    this.atlas.nodes.forEach((j: Fp2, v: number) => {
      const { x, y } = this.xy(v);
      const special = eq(j, fp2(0)) || eq(j, fp2(1728));
      const g = el('g', {
        class: `node${this.atlas.spine[v] ? ' spine' : ''}`,
        tabindex: '0',
        role: 'button',
        'aria-label': this.nodeAria(v),
      });
      let shape: SVGElement;
      if (this.atlas.spine[v]) {
        const s = special ? 22 : 16;
        shape = el('rect', {
          x: `${x - s / 2}`,
          y: `${y - s / 2}`,
          width: `${s}`,
          height: `${s}`,
          rx: '3',
          class: 'node-shape',
        });
      } else {
        shape = el('circle', {
          cx: `${x}`,
          cy: `${y}`,
          r: special ? '12' : '9',
          class: 'node-shape',
        });
      }
      // Transparent hit region: with the SVG's 640px minimum rendered width
      // (scale ≥ 0.89), r = 14 gives a ≥ 24 CSS px touch target (WCAG 2.2 AA
      // target size) without visually enlarging the vertex.
      const hit = el('circle', {
        cx: `${x}`,
        cy: `${y}`,
        r: '14',
        class: 'node-hit',
      });
      const t = el('title');
      t.textContent = `j = ${show(j)}`;
      g.append(hit, shape, t);
      if (special) {
        const label = el('text', {
          x: `${x}`,
          y: `${y - 16}`,
          'text-anchor': 'middle',
          class: 'node-label',
        });
        label.textContent = eq(j, fp2(0)) ? 'j=0' : 'j=1728≡4';
        g.append(label);
      }
      g.addEventListener('click', () => this.onActivate(v));
      g.addEventListener('keydown', (ev: KeyboardEvent) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          this.onActivate(v);
        }
      });
      this.nodeLayer.append(g);
      this.nodeEls.push(g);
    });
  }

  private nodeAria(v: number, state = ''): string {
    const j = this.atlas.nodes[v];
    const parts = [`curve j = ${show(j)}`];
    if (this.atlas.spine[v]) parts.push('on the GF(431) spine');
    if (state) parts.push(state);
    return parts.join(', ');
  }

  setNodeState(v: number, state: string): void {
    this.nodeEls[v].setAttribute('aria-label', this.nodeAria(v, state));
  }

  addNodeClass(v: number, cls: string): void {
    this.nodeEls[v].classList.add(cls);
  }

  removeNodeClass(v: number, cls: string): void {
    this.nodeEls[v].classList.remove(cls);
  }

  highlightNodes(vs: Iterable<number>, cls: string): void {
    for (const v of vs) this.addNodeClass(v, cls);
  }

  /** Add `cls` to the nodes and (existing, current-ℓ) edges along a walk. */
  highlightPath(path: readonly number[], cls: string): void {
    for (const v of path) this.addNodeClass(v, cls);
    for (let i = 0; i + 1 < path.length; i++) {
      const a = Math.min(path[i], path[i + 1]);
      const b = Math.max(path[i], path[i + 1]);
      this.edgeEls.get(`${a}-${b}`)?.classList.add(cls);
    }
  }

  /** Remove every highlight class from nodes and edges, and reset aria state. */
  clearHighlights(): void {
    const HLS = [
      'hl-start',
      'hl-target',
      'hl-frontier',
      'hl-path',
      'hl-path-b',
      'hl-set',
      'hl-here',
      'dim',
    ];
    this.nodeEls.forEach((g, v) => {
      g.classList.remove(...HLS);
      g.setAttribute('aria-label', this.nodeAria(v));
    });
    for (const e of this.edgeEls.values()) e.classList.remove(...HLS);
  }

  focusNode(v: number): void {
    this.nodeEls[v].focus();
  }
}
