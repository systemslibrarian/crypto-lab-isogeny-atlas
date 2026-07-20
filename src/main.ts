/**
 * Isogeny Atlas — wiring. The math lives in src/math/ (tested, deterministic);
 * this file computes the graph live at load, renders it, and drives the three
 * exhibits: the atlas inspector, the path-finding playground, and the
 * seven-problems tour.
 */

import './style.css';
import { fp2, show, key } from './math/fp2';
import {
  buildAtlas,
  adjOf,
  edgeCount,
  massFormulaHolds,
  outDegree,
} from './math/graph';
import { layoutAtlas } from './math/layout';
import {
  bfsPath,
  type BfsResult,
  exactLengthEndpoints,
  cyclesThrough,
  cglWalk,
  messageBits,
  findCollision,
} from './math/walk';
import { curveFromJ } from './math/curve';
import { AtlasView } from './ui/atlas';
import { PROBLEMS } from './ui/problems';

const $ = <T extends HTMLElement>(sel: string): T => {
  const node = document.querySelector<T>(sel);
  if (!node) throw new Error(`missing element ${sel}`);
  return node;
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- build & render ---------------- */

const atlas = buildAtlas();
const positions = layoutAtlas(atlas);
const view = new AtlasView(
  document.querySelector('#atlas-svg') as unknown as SVGSVGElement,
  atlas,
  positions,
);

const J1728 = atlas.index.get(key(fp2(1728)))!;

// 1728 ≡ 4 (mod 431): show the famous name alongside the reduced value.
const nodeName = (v: number): string =>
  v === J1728 ? 'j = 4 (≡ 1728)' : `j = ${show(atlas.nodes[v])}`;

const statusEl = $('#atlas-status');
statusEl.textContent =
  `Computed live in ${atlas.buildMs.toFixed(0)} ms: ${atlas.nodes.length} supersingular curves, ` +
  `${edgeCount(atlas.adj2)} two-isogeny edges, ${edgeCount(atlas.adj3)} three-isogeny edges. ` +
  `Nothing on this page is hard-coded.`;

/* live self-checks shown in the Exhibit 1 details */
const checks: Array<[string, boolean]> = [
  [
    `vertex count is ⌊p/12⌋ + 2 = ${Math.floor(atlas.p / 12) + 2} (p ≡ 11 mod 12)`,
    atlas.nodes.length === Math.floor(atlas.p / 12) + 2,
  ],
  [
    'Eichler mass formula Σ 1/|Aut| = (p − 1)/24 holds exactly',
    massFormulaHolds(atlas),
  ],
  [
    'every vertex has exactly 3 outgoing 2-isogenies (counting multiplicity)',
    atlas.adj2.every((edges) => outDegree(edges) === 3),
  ],
  [
    'every vertex has exactly 4 outgoing 3-isogenies (counting multiplicity)',
    atlas.adj3.every((edges) => outDegree(edges) === 4),
  ],
];
const checkList = $('#self-check-list');
for (const [label, ok] of checks) {
  const li = document.createElement('li');
  li.textContent = `${ok ? '✓' : '✗ FAILED:'} ${label}`;
  checkList.append(li);
}

const dump = $('#adj-dump');
dump.textContent = atlas.nodes
  .map((j, v) => {
    const nbrs = atlas.adj2[v]
      .map((e) => `${show(atlas.nodes[e.to])}${e.mult > 1 ? `×${e.mult}` : ''}`)
      .join(',  ');
    return `${show(j).padEnd(12)} → ${nbrs}`;
  })
  .join('\n');

/* ---------------- vertex inspector ---------------- */

const nodeInfo = $('#node-info');

const describeNode = (v: number): void => {
  const j = atlas.nodes[v];
  const c = curveFromJ(j);
  const conjV = atlas.conjIndex[v];
  const nbr2 = atlas.adj2[v].map((e) => show(atlas.nodes[e.to])).join(', ');
  const nbr3 = atlas.adj3[v].map((e) => show(atlas.nodes[e.to])).join(', ');
  nodeInfo.innerHTML = `
    <p><strong>Curve with ${nodeName(v)}</strong></p>
    <dl>
      <dt>Model</dt><dd>y² = x³ + (${show(c.a)})x + ${show(c.b)}</dd>
      <dt>Field of j</dt><dd>${atlas.spine[v] ? 'GF(431) — spine' : 'GF(431²)'}</dd>
      <dt>Conjugate</dt><dd>${conjV === v ? 'itself (Frobenius-fixed)' : `j = ${show(atlas.nodes[conjV])}`}</dd>
      <dt>|Aut|</dt><dd>${atlas.autOrder[v]}${atlas.autOrder[v] > 2 ? ' (extra automorphisms!)' : ''}</dd>
      <dt>2-isogenous to</dt><dd>${nbr2}</dd>
      <dt>3-isogenous to</dt><dd>${nbr3}</dd>
    </dl>
    <div class="controls-row">
      <button type="button" id="btn-info-start">Set as start</button>
      <button type="button" id="btn-info-target">Set as target</button>
    </div>`;
  $('#btn-info-start').addEventListener('click', () => {
    selStart.value = String(v);
    resetSearch(`Start set to ${nodeName(v)}.`);
  });
  $('#btn-info-target').addEventListener('click', () => {
    selTarget.value = String(v);
    resetSearch(`Target set to ${nodeName(v)}.`);
  });
};

/* ---------------- edge-set toggle ---------------- */

for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="ell"]')) {
  radio.addEventListener('change', () => {
    view.setEll(Number(radio.value) as 2 | 3);
    resetSearch(`Edge set switched to ${radio.value}-isogenies.`);
  });
}

/* ---------------- exhibit 2: path-finding ---------------- */

const selStart = $('#sel-start') as unknown as HTMLSelectElement;
const selTarget = $('#sel-target') as unknown as HTMLSelectElement;
const pathStatus = $('#path-status');
const walkButtons = $('#walk-buttons');

atlas.nodes.forEach((_, v) => {
  for (const sel of [selStart, selTarget]) {
    const opt = document.createElement('option');
    opt.value = String(v);
    opt.textContent = nodeName(v);
    sel.append(opt);
  }
});
selStart.value = String(J1728);
// default target: the vertex BFS finds farthest from 1728 (deterministic)
{
  let far = 0;
  let farD = -1;
  for (let v = 0; v < atlas.nodes.length; v++) {
    const r = bfsPath(atlas.adj2, J1728, v);
    const d = (r.path?.length ?? 1) - 1;
    if (d > farD) {
      farD = d;
      far = v;
    }
  }
  selTarget.value = String(far);
}

let animTimer: number | null = null;
let stepState: { result: BfsResult; next: number } | null = null;
let manual: { here: number; steps: number } | null = null;

const setStatus = (msg: string, tone: '' | 'good' | 'warn' = ''): void => {
  pathStatus.textContent = msg;
  pathStatus.className = `status${tone ? ` ${tone}` : ''}`;
};

const markEndpoints = (): { s: number; t: number } => {
  const s = Number(selStart.value);
  const t = Number(selTarget.value);
  view.addNodeClass(s, 'hl-start');
  view.addNodeClass(t, 'hl-target');
  view.setNodeState(s, 'start of search');
  view.setNodeState(t, 'target of search');
  return { s, t };
};

const resetSearch = (msg = 'Cleared.'): void => {
  if (animTimer !== null) window.clearInterval(animTimer);
  animTimer = null;
  stepState = null;
  manual = null;
  walkButtons.replaceChildren();
  view.clearHighlights();
  markEndpoints();
  setStatus(msg);
};

const showLayer = (layers: readonly (readonly number[])[], d: number): void => {
  view.highlightNodes(layers[d], 'hl-frontier');
};

const finishSearch = (
  path: readonly number[] | null,
  visited: number,
  layers: readonly (readonly number[])[],
): void => {
  if (path === null) {
    setStatus('Unreachable — cannot happen in a connected graph.', 'warn');
    return;
  }
  view.highlightPath(path, 'hl-path');
  const pretty = path.map((v) => show(atlas.nodes[v])).join(' → ');
  setStatus(
    `Found a ${path.length - 1}-step path after touching ${visited} of ${atlas.nodes.length} curves ` +
      `(frontier flooded ${layers.length - 1} layers): ${pretty}. ` +
      `Same flood at p ≈ 2²⁵⁶ would touch ~2¹²⁸ curves — that gap is the cryptography.`,
    'good',
  );
};

$('#btn-bfs-run').addEventListener('click', () => {
  resetSearch();
  const { s, t } = markEndpoints();
  const r = bfsPath(adjOf(atlas, view.getEll()), s, t);
  if (reducedMotion) {
    r.layers.forEach((_, d) => showLayer(r.layers, d));
    finishSearch(r.path, r.visited, r.layers);
    return;
  }
  let d = 0;
  setStatus('Searching…');
  animTimer = window.setInterval(() => {
    if (d < r.layers.length) {
      showLayer(r.layers, d);
      setStatus(
        `Layer ${d}: ${r.layers[d].length} curve(s) at distance ${d} — ${r.layers[d]
          .slice(0, 6)
          .map((v) => show(atlas.nodes[v]))
          .join(', ')}${r.layers[d].length > 6 ? ', …' : ''}`,
      );
      d++;
    } else {
      if (animTimer !== null) window.clearInterval(animTimer);
      animTimer = null;
      finishSearch(r.path, r.visited, r.layers);
    }
  }, 650);
});

$('#btn-bfs-step').addEventListener('click', () => {
  if (stepState === null) {
    resetSearch();
    const { s, t } = markEndpoints();
    const result = bfsPath(adjOf(atlas, view.getEll()), s, t);
    stepState = { result, next: 0 };
    setStatus('Step-by-step search armed — press again to reveal each layer.');
    return;
  }
  const { result } = stepState;
  if (stepState.next < result.layers.length) {
    showLayer(result.layers, stepState.next);
    setStatus(
      `Layer ${stepState.next}: ${result.layers[stepState.next].length} curve(s) at distance ${stepState.next}.`,
    );
    stepState.next++;
  } else {
    finishSearch(result.path, result.visited, result.layers);
    stepState = null;
  }
});

const renderManualButtons = (): void => {
  if (manual === null) return;
  const target = Number(selTarget.value);
  walkButtons.replaceChildren();
  const label = document.createElement('p');
  label.textContent = `You are at ${nodeName(manual.here)} (${manual.steps} step${manual.steps === 1 ? '' : 's'} so far). Choose your next isogeny:`;
  walkButtons.append(label);
  for (const e of adjOf(atlas, view.getEll())[manual.here]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `→ ${nodeName(e.to)}${e.mult > 1 ? ` (×${e.mult})` : ''}`;
    b.addEventListener('click', () => {
      if (manual === null) return;
      manual.here = e.to;
      manual.steps++;
      view.clearHighlights();
      markEndpoints();
      view.addNodeClass(manual.here, 'hl-here');
      view.setNodeState(manual.here, 'your current position');
      if (manual.here === target) {
        const optimal =
          bfsPath(adjOf(atlas, view.getEll()), Number(selStart.value), target).path!
            .length - 1;
        setStatus(
          `You reached the target in ${manual.steps} steps — the shortest path has ${optimal}. ` +
            `You had a map of all 37 curves. At p ≈ 2²⁵⁶ there are ~2²⁵² curves and no map: ` +
            `that is the path-finding problem.`,
          'good',
        );
        manual = null;
        walkButtons.replaceChildren();
      } else {
        renderManualButtons();
      }
    });
    walkButtons.append(b);
  }
};

$('#btn-walk-self').addEventListener('click', () => {
  resetSearch();
  const { s } = markEndpoints();
  manual = { here: s, steps: 0 };
  view.addNodeClass(s, 'hl-here');
  setStatus(
    'Manual mode: walk edge by edge using the buttons below (or watch the graph as you go).',
  );
  renderManualButtons();
});

$('#btn-shuffle').addEventListener('click', () => {
  const n = atlas.nodes.length;
  const current = Number(selTarget.value);
  let next = (current + 7) % n;
  if (next === Number(selStart.value)) next = (next + 1) % n;
  selTarget.value = String(next);
  resetSearch(`Target shuffled to ${nodeName(next)}.`);
});

$('#btn-clear').addEventListener('click', () => resetSearch());

for (const sel of [selStart, selTarget]) {
  sel.addEventListener('change', () => resetSearch('Endpoints updated.'));
}

view.onActivate = (v) => {
  describeNode(v);
};

/* ---------------- exhibit 3: the seven problems ---------------- */

const panel = $('#problem-panel');
const numsWrap = $('#tour-nums');
let current = 0;

const numButtons: HTMLButtonElement[] = PROBLEMS.map((p, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'num';
  b.textContent = String(p.n);
  b.setAttribute('aria-label', `Problem ${p.n}: ${p.title}`);
  b.addEventListener('click', () => showProblem(i));
  numsWrap.append(b);
  return b;
});

$('#tour-prev').addEventListener('click', () =>
  showProblem((current + PROBLEMS.length - 1) % PROBLEMS.length),
);
$('#tour-next').addEventListener('click', () => showProblem((current + 1) % PROBLEMS.length));

const problemStatus = (): HTMLElement => $('#problem-status');

function renderProblem(i: number): void {
  const p = PROBLEMS[i];
  panel.innerHTML = `
    <span class="problem-tagline">On the graph: ${p.tagline}</span>
    <h3>Problem ${p.n} — ${p.title}</h3>
    <p>${p.plain}</p>
    <div class="controls-row" id="problem-widget"></div>
    <p id="problem-status" class="status" role="status" aria-live="polite"></p>
    <details>
      <summary>The precise problem &amp; its stakes</summary>
      ${p.precise}
      <p class="problem-refs">
        Read more: ${p.refs
          .map((r) => `<a href="${r.url}">${r.label}</a>`)
          .join(' · ')}
      </p>
    </details>`;
  wireWidget(p.n);
}

function showProblem(i: number): void {
  current = i;
  numButtons.forEach((b, k) => {
    if (k === i) b.setAttribute('aria-current', 'true');
    else b.removeAttribute('aria-current');
  });
  view.clearHighlights();
  renderProblem(i);
}

/** Deterministic "interesting" vertex choices for the tour. */
const farFrom = (v: number): number => {
  let far = v;
  let best = -1;
  for (let t = 0; t < atlas.nodes.length; t++) {
    const d = (bfsPath(atlas.adj2, v, t).path?.length ?? 1) - 1;
    if (d > best) {
      best = d;
      far = t;
    }
  }
  return far;
};

function wireWidget(n: number): void {
  const wrap = $('#problem-widget');
  const p = PROBLEMS[n - 1];
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'primary';
  btn.textContent = p.action;
  wrap.append(btn);
  const say = (msg: string, tone: '' | 'good' | 'warn' = ''): void => {
    const el = problemStatus();
    el.textContent = msg;
    el.className = `status${tone ? ` ${tone}` : ''}`;
  };

  switch (n) {
    case 1: {
      const a = J1728;
      const b = farFrom(a);
      view.addNodeClass(a, 'hl-start');
      view.addNodeClass(b, 'hl-target');
      say(
        `Two curves are marked: ${nodeName(a)} and ${nodeName(b)}. A path between them certainly exists — the graph is an expander. Finding it is the problem.`,
      );
      btn.addEventListener('click', () => {
        view.clearHighlights();
        view.addNodeClass(a, 'hl-start');
        view.addNodeClass(b, 'hl-target');
        const r = bfsPath(atlas.adj2, a, b);
        view.highlightPath(r.path!, 'hl-path');
        say(
          `Revealed: ${r.path!.map((v) => show(atlas.nodes[v])).join(' → ')} — ${r.path!.length - 1} steps, found by flooding ${r.visited} of 37 curves. At p ≈ 2²⁵⁶, that flood is ~2¹²⁸ curves.`,
          'good',
        );
      });
      break;
    }
    case 2:
    case 3: {
      const max = n === 2 ? 3 : 1;
      const base = n === 2 ? J1728 : farFrom(J1728);
      view.addNodeClass(base, 'hl-start');
      say(
        n === 2
          ? `Base curve: ${nodeName(base)} — its endomorphism ring is actually known (it has CM by ℤ[i]), which is exactly what makes it a dangerous starting curve.`
          : `Base curve: ${nodeName(base)} — a "generic" vertex deep in the graph. Find one closed loop through it.`,
      );
      btn.addEventListener('click', () => {
        view.clearHighlights();
        view.addNodeClass(base, 'hl-start');
        const cycles = cyclesThrough(atlas.adj2, base, max);
        const classes = ['hl-path', 'hl-path-b', 'hl-set'];
        cycles.forEach((cyc, i) => view.highlightPath(cyc, classes[i % classes.length]));
        const desc = cycles
          .map((cyc) => `length ${cyc.length - 1} (an endomorphism of degree 2^${cyc.length - 1})`)
          .join('; ');
        say(
          `${cycles.length} closed walk(s) through ${nodeName(base)}: ${desc}. ` +
            (n === 2
              ? 'Enough independent cycles pin down the whole ring — computing it for an arbitrary curve is the open problem.'
              : 'Even ONE such loop, for an arbitrary curve, is provably as hard as computing the entire ring (Page–Wesolowski).'),
          'good',
        );
      });
      break;
    }
    case 4: {
      const start = J1728;
      view.addNodeClass(start, 'hl-start');
      const label = document.createElement('label');
      label.setAttribute('for', 'deg-slider');
      label.textContent = 'walk length k (degree 2^k):';
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.id = 'deg-slider';
      slider.min = '1';
      slider.max = '8';
      slider.value = '4';
      wrap.append(label, slider);
      const showK = (): void => {
        const k = Number(slider.value);
        view.clearHighlights();
        view.addNodeClass(start, 'hl-start');
        const ends = exactLengthEndpoints(atlas.adj2, start, k);
        view.highlightNodes(ends, 'hl-set');
        say(
          `${ends.size} of 37 curves are endpoints of a cyclic degree-2^${k} = ${2 ** k} isogeny from j = 1728. ` +
            `"Reach this exact curve with this exact degree" is a different — and differently hard — question than "reach it at all".`,
        );
      };
      slider.addEventListener('input', showK);
      btn.addEventListener('click', showK);
      showK();
      break;
    }
    case 5: {
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'hash-msg';
      input.value = 'hello isogenies';
      const label = document.createElement('label');
      label.setAttribute('for', 'hash-msg');
      label.textContent = 'message:';
      wrap.prepend(label, input);
      btn.addEventListener('click', () => {
        view.clearHighlights();
        const bits = messageBits(input.value || ' ');
        const w = cglWalk(atlas.adj2, J1728, bits);
        view.addNodeClass(J1728, 'hl-start');
        view.highlightPath(w.path, 'hl-path');
        view.addNodeClass(w.end, 'hl-target');
        say(
          `Hashed ${w.bitsUsed} bits into a ${w.path.length - 1}-step walk from j = 1728, landing on ${nodeName(w.end)}. ` +
            `Note what just happened: to produce this "random" curve, you walked there — so you know a path to it, and with it (in principle) its endomorphism ring. ` +
            `Producing a supersingular curve NOBODY knows a path to, without trusted setup, is the open problem.`,
          'good',
        );
      });
      break;
    }
    case 6: {
      btn.addEventListener('click', () => {
        view.clearHighlights();
        const spineVerts: number[] = [];
        atlas.spine.forEach((s, v) => {
          if (s) spineVerts.push(v);
        });
        view.highlightNodes(spineVerts, 'hl-set');
        say(
          `${spineVerts.length} of 37 curves have j ∈ GF(431) — the squares, now outlined. ` +
            `These carry the commutative group action behind CSIDH-style key exchange. ` +
            `More symmetry to build with — and more symmetry for Kuperberg's quantum algorithm to exploit. ` +
            `See the toy CSIDH in crypto-lab-isogeny-gate to use this spine for key exchange.`,
          'good',
        );
      });
      break;
    }
    case 7: {
      btn.addEventListener('click', () => {
        view.clearHighlights();
        const col = findCollision(atlas.adj2, J1728, 8);
        if (!col) {
          say('No collision at this length — try again.', 'warn');
          return;
        }
        view.addNodeClass(J1728, 'hl-start');
        view.highlightPath(col.pathA, 'hl-path');
        view.highlightPath(col.pathB, 'hl-path-b');
        view.addNodeClass(col.end, 'hl-target');
        say(
          `Collision found by brute force: bit-strings ${col.bitsA} (solid) and ${col.bitsB} (dashed) both hash from j = 1728 to ${nodeName(col.end)}. ` +
            `Gluing one path to the other, reversed, gives a closed loop — an endomorphism, from nothing but a collision. ` +
            `Brute force works here because there are 37 curves; at ~2²⁵² curves it does not, and no better method is known from an unknown-ring start.`,
          'good',
        );
      });
      break;
    }
  }
}

/* initialize */
markEndpoints();
showProblem(0);
