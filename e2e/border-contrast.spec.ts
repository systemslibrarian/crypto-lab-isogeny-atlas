import { expect, test } from '@playwright/test';

/**
 * WCAG 2.1 SC 1.4.11 — Non-text Contrast, 3:1.
 *
 * axe has no rule for this and the arithmetic walk in `contrast.ts` measures
 * text nodes, so nothing else in this repo can see it. It covers two kinds of
 * thing here:
 *
 *   - CONTROL BOUNDARIES. A control has to be distinguishable from what
 *     surrounds it. Either delineator will do — the fill against the surface
 *     just outside the element, or the border against that same surface — and
 *     an element fails only when NEITHER clears 3:1, which is the case where
 *     the control genuinely dissolves into its panel.
 *
 *   - THE GRAPH'S OWN STROKES. This lab is an atlas: the edges and vertices
 *     ARE the content, not decoration around it, so they are graphical objects
 *     required to understand it.
 *
 * WHAT THIS FILE USED TO BE, AND WHY THAT MATTERED. It measured exactly one
 * element — `#sel-inspect` — and it measured that element's border against its
 * OWN background rather than against the surface outside it. `#sel-inspect` is
 * a `<select>`, and `<select>` is one of only two rules in the entire
 * stylesheet that use `--c-control-border`, the token introduced for precisely
 * this requirement. So the check queried one of the two elements that already
 * passed and reported the palette healthy, while `#app button` — every button
 * in all three exhibits — drew its edge in `--c-border` and measured 1.46:1
 * (dark) / 1.50:1 (light) against the card behind it, over a fill that is
 * 1.09:1. A check that can only be green is not a check.
 */

interface Finding {
  what: string;
  ratio: number;
  detail: string;
}

for (const theme of ['dark', 'light'] as const) {
  for (const width of [1280, 380]) {
    test(`non-text contrast clears 3:1 — ${theme} theme at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
      await page.goto('.');
      await expect(page.locator('#atlas-status')).toContainText('37 supersingular curves');

      // Drive far enough that every control class exists: the walk buttons and
      // the tour's widget controls are created by script and are absent at
      // first paint, and a boundary that is never rendered is never measured.
      await page.locator('#atlas-svg .node').first().click();
      await expect(page.locator('#node-info')).toContainText('Model');
      await page.locator('#btn-walk-self').click();
      await expect(page.locator('#walk-buttons button').first()).toBeVisible();
      await page.locator('.tour-nav .num').nth(3).click();
      await expect(page.locator('#deg-slider')).toBeVisible();

      const findings: Finding[] = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        // The canvas is the browser's own colour pipeline: it converts any valid
        // CSS colour — oklab, color-mix, named, hex — to sRGB, which a regex
        // over `rgb()` cannot.
        const rgb = (value: string): [number, number, number] | null => {
          if (!value || value === 'none' || value === 'transparent') return null;
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = '#000';
          ctx.fillStyle = value;
          const a = ctx.fillStyle;
          ctx.fillStyle = '#fff';
          ctx.fillStyle = value;
          if (a !== ctx.fillStyle) return null;
          ctx.fillRect(0, 0, 1, 1);
          const d = ctx.getImageData(0, 0, 1, 1).data;
          if (d[3] === 0) return null;
          return [d[0]!, d[1]!, d[2]!];
        };
        const lum = ([r, g, b]: [number, number, number]): number => {
          const f = (c: number): number => {
            const v = c / 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const ratio = (a: [number, number, number], b: [number, number, number]): number => {
          const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
          return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
        };

        /** The first ancestor that paints an opaque background. */
        const surroundOf = (el: Element): [number, number, number] => {
          let node: Element | null = el.parentElement;
          while (node) {
            const c = rgb(getComputedStyle(node).backgroundColor);
            if (c) return c;
            node = node.parentElement;
          }
          return rgb(getComputedStyle(document.documentElement).backgroundColor) ?? [255, 255, 255];
        };

        const out: { what: string; ratio: number; detail: string }[] = [];
        const name = (el: Element): string =>
          `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}` +
          `${el.getAttribute('class') ? '.' + el.getAttribute('class')!.trim().split(/\s+/).join('.') : ''}`;

        // ── controls ────────────────────────────────────────────────────────
        const CONTROL = '#app button, #app select, #app input, #app summary, #app [tabindex="0"]';
        for (const el of Array.from(document.querySelectorAll(CONTROL))) {
          if (!(el as HTMLElement).checkVisibility?.()) continue;
          // 1.4.11 exempts inactive components.
          if ((el as HTMLInputElement).disabled) continue;
          const cs = getComputedStyle(el);
          // …and components the user agent paints and the author has not taken
          // over. A native radio/checkbox/range still reports a background and a
          // border, but they are the UA's, not the author's.
          if (
            cs.appearance !== 'none' &&
            ['checkbox', 'radio', 'range'].includes((el as HTMLInputElement).type ?? '')
          )
            continue;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) continue;

          const surround = surroundOf(el);
          const fill = rgb(cs.backgroundColor);
          const borderVisible =
            parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none';
          const border = borderVisible ? rgb(cs.borderTopColor) : null;
          if (!fill && !border) continue; // identified by its text alone

          const candidates: [string, number][] = [];
          if (fill) candidates.push(['fill', ratio(fill, surround)]);
          if (border) candidates.push(['border', ratio(border, surround)]);
          const best = candidates.sort((a, b) => b[1] - a[1])[0]!;
          if (best[1] < 3) {
            out.push({
              what: name(el),
              ratio: best[1],
              detail: `best delineator is the ${best[0]} at ${best[1]}:1 against the surface behind it`,
            });
          }
        }

        // ── the graph's own strokes and shapes ───────────────────────────────
        const svg = document.querySelector('#atlas-svg')!;
        const graphBg = rgb(getComputedStyle(svg).backgroundColor) ?? surroundOf(svg);
        const seen = new Set<string>();
        for (const el of Array.from(svg.querySelectorAll('.edge, .node-shape'))) {
          const cls = el.getAttribute('class') ?? '';
          const key = `${el.tagName}|${cls}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const cs = getComputedStyle(el);
          const stroke = rgb(cs.stroke);
          const fill = rgb(cs.fill);
          const candidates: [string, number][] = [];
          if (fill) candidates.push(['fill', ratio(fill, graphBg)]);
          if (stroke && parseFloat(cs.strokeWidth) > 0)
            candidates.push(['stroke', ratio(stroke, graphBg)]);
          if (!candidates.length) continue;
          const best = candidates.sort((a, b) => b[1] - a[1])[0]!;
          if (best[1] < 3) {
            out.push({
              what: `${el.tagName.toLowerCase()}.${cls.trim().split(/\s+/).join('.')}`,
              ratio: best[1],
              detail: `the graph's ${best[0]} is ${best[1]}:1 against the panel it is drawn on`,
            });
          }
        }
        // ── the legend swatches, which are the key to the graph's colours ──
        for (const el of Array.from(document.querySelectorAll('.legend .swatch'))) {
          const cs = getComputedStyle(el);
          const fill = rgb(cs.backgroundColor);
          if (!fill) continue;
          const r = ratio(fill, surroundOf(el));
          if (r < 3) {
            out.push({
              what: name(el),
              ratio: r,
              detail: `legend swatch fill is ${r}:1 against the card behind it`,
            });
          }
        }
        return out;
      });

      expect(
        findings.map((f) => `${f.ratio}:1 ${f.what} — ${f.detail}`),
        'non-text contrast below 3:1 (WCAG 2.1 SC 1.4.11)'
      ).toEqual([]);
    });
  }
}
