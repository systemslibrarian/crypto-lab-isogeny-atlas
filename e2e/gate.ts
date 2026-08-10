import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { auditContrast, formatContrastFailures } from './contrast';

export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** A phone-width viewport, for the WCAG 1.4.10 reflow half of the gate. */
export const NARROW = { width: 380, height: 800 };

/**
 * Collection mode: run every configuration to the end and report everything at
 * once, instead of stopping at the first finding in the first state.
 *
 * A gate that fails fast is right for CI and wrong for a remediation pass —
 * fixing one finding per full run wastes a run each time. `A11Y_COLLECT=1`
 * turns the oracles' assertions into recordings.
 *
 * It cannot be mistaken for a passing gate. `reportCollected()` runs at the end
 * of every test in both modes and FAILS if anything was recorded, so a
 * collecting run that found something is still a red run; and with the variable
 * unset — which is how CI and every commit-time run behave — each oracle
 * asserts immediately, exactly as if this switch did not exist.
 */
const COLLECT = !!process.env.A11Y_COLLECT;
const collected: string[] = [];

/**
 * Assert a finding list is empty, or record it in collection mode.
 * `null` and `[]` both mean "nothing found"; anything else is a finding.
 */
function softExpect(value: unknown[] | Record<string, unknown> | null, message: string): void {
  const clean = value === null || (Array.isArray(value) && value.length === 0);
  if (clean) return;
  if (COLLECT) {
    collected.push(`${message}\n${JSON.stringify(value, null, 2)}`);
    return;
  }
  expect(value, message).toEqual(Array.isArray(value) ? [] : null);
}

/** Fail the test if a collection run recorded anything. Call once, at the end. */
export function reportCollected(): void {
  expect(
    collected,
    'findings recorded in collection mode — a collecting run that finds anything is still a failing run'
  ).toEqual([]);
}

/**
 * Shared machinery for the WCAG gate.
 *
 * Three rules govern everything here:
 *
 *  1. NOTHING IS INJECTED INTO THE PAGE BEFORE A SCAN. The gate this replaces
 *     opened `driveDemos()` with an `addStyleTag` setting `animation: none
 *     !important; transition: none !important` on every element and
 *     pseudo-element. That makes the suite structurally unable to see a motion
 *     defect, and it BYPASSES this lab's own `@media (prefers-reduced-motion:
 *     reduce)` block instead of exercising it — which matters here more than
 *     most, because `reducedMotion` is read once at module load and decides
 *     whether the BFS flood animates over seconds or lands in a single frame.
 *     The old gate measured neither branch honestly: it froze the CSS animation
 *     while the JS still took the animated path. It also force-opened every
 *     `<details>` with `d.open = true` from script rather than clicking the
 *     summary.
 *
 *  2. EVERY SCAN ASSERTS ITS CONTENT IS PRESENT FIRST, and there are scans well
 *     past first paint. axe over an empty container passes having checked
 *     nothing. At first paint this lab's inspector says only "Select a vertex",
 *     the path status is empty, no walk buttons exist and no problem is open —
 *     and the old gate scanned ONCE, at the very end, so all thirty-odd states
 *     it built along the way were thrown away unmeasured.
 *
 *  3. `violations` IS NOT THE WHOLE ORACLE. See `scan`.
 */

/**
 * Wait for every running animation and transition to drain.
 *
 * Transitions drain in waves, not in one batch, so a poll for "nothing running
 * right now" can exit through a gap between waves. Require quiescence to hold
 * for several consecutive frames instead.
 *
 * This lab's stylesheet cancels animation outright under reduced motion, so
 * quiescence arrives as soon as layout settles.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __quietFrames?: number };
      const running = document.getAnimations().filter((a) => a.playState === 'running');
      w.__quietFrames = running.length === 0 ? (w.__quietFrames ?? 0) + 1 : 0;
      return w.__quietFrames >= 6;
    },
    undefined,
    { timeout: 20_000, polling: 'raf' }
  );
}

/**
 * Assert that reduced motion left the page visible, not merely un-animated.
 *
 * The failure mode this guards against is an element whose only route to its
 * visible state is an animation, in a stylesheet whose reduced-motion block
 * cancels that animation without restoring its end state — the element then
 * renders at `opacity: 0` for every reader with the preference set. This lab's
 * blanket `animation: none !important` block is exactly the shape that does
 * that, so the check is not theoretical here.
 */
async function expectNotBlank(page: Page, label: string): Promise<void> {
  const invisible = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!own) continue;
      // Deliberately hidden subtrees are not "blank", they are closed.
      if (!(el as HTMLElement).checkVisibility?.({ checkVisibilityCSS: true })) continue;
      let effective = 1;
      let node: Element | null = el;
      while (node) {
        effective *= parseFloat(getComputedStyle(node).opacity);
        node = node.parentElement;
      }
      if (effective === 0) {
        out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}`);
      }
    }
    return Array.from(new Set(out));
  });
  softExpect(invisible, `no visible text may render at opacity 0 in state: ${label}`);
}

/**
 * Load the page in a known theme with reduced motion actually in effect, and
 * assert the content every scan relies on is really on the page.
 *
 * `test.use({ reducedMotion })` silently does nothing on Playwright 1.61.1, so
 * the emulation is applied imperatively BEFORE the navigation and then
 * *asserted* from inside the page.
 *
 * THE DEFAULTS ARE ASSERTED, NOT ASSUMED. Which edge set is displayed decides
 * which of two different graphs every exhibit computes in, and the inspector,
 * the path status and the tour all start empty. All of that is read back here,
 * because a drive that starts from the wrong assumption about the displayed
 * edge set measures one graph twice and the other never.
 */
export async function boot(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
  await page.goto('.');
  // A click on a control that never becomes actionable otherwise burns the whole
  // test timeout and reports nothing useful. 20s turns that silent hang into a
  // named failure naming the locator.
  page.setDefaultTimeout(20_000);
  expect(
    await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    'reduced-motion emulation must actually be in effect'
  ).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

  // The graph is computed from the modular polynomials at load and every
  // exhibit reads it, so a navigation that resolves proves nothing until that
  // computation has landed and drawn 37 vertices.
  await expect(page.locator('#atlas-status')).toContainText('37 supersingular curves');
  await expect(page.locator('#atlas-svg .node')).toHaveCount(37);
  // The lab's own live self-checks must all be ticks. A failed one would leave
  // the rest of this drive measuring a graph the lab itself does not believe.
  await expect(page.locator('#self-check-list li')).toHaveCount(4);
  expect(
    await page.locator('#self-check-list').innerText(),
    'the atlas must pass its own four self-checks before anything else is measured'
  ).not.toContain('FAILED');

  // Defaults, asserted. The edge set is the big one: it decides which of two
  // different graphs every exhibit computes in.
  await expect(page.getByLabel('2-isogenies (3-regular)')).toBeChecked();
  await expect(page.getByLabel('3-isogenies (4-regular)')).not.toBeChecked();
  await expect(page.locator('#sel-inspect')).toHaveValue('');
  await expect(page.locator('#node-info')).toContainText('Select a vertex');
  // …and the path status ships with its prompt, not empty. Asserting "" here is
  // what caught that assumption: a drive that waited for an empty status line
  // would have hung on a page behaving perfectly.
  await expect(page.locator('#path-status')).toContainText(
    'Choose a start and target, then walk yourself or run the search.'
  );
  await expect(page.locator('#walk-buttons')).toBeEmpty();

  await settle(page);
  await expectNotBlank(page, `${theme} first paint`);
}

/**
 * Assert the page does not require horizontal scrolling.
 *
 * WCAG 1.4.10 (Reflow, AA). axe has no rule for this at all, and this lab is a
 * plausible offender: the graph carries `min-width: 640px`, the adjacency dump
 * is `white-space: pre` with 37 rows of neighbour lists, and the scale table
 * carries `min-width: 30rem`. Each is meant to live inside its own scroller;
 * this asserts none of them escapes to the document.
 */
export async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    // `body { overflow-x: hidden }` propagates to the viewport when `html`
    // leaves `overflow` at `visible`, so `scrollWidth` stays equal to
    // `clientWidth` even when content is CUT OFF — a worse 1.4.10 outcome than
    // a scrollbar, and invisible to the standard check. Detect the clipping
    // directly rather than trusting the scroll geometry.
    const clippedByViewport = ['hidden', 'clip'].includes(
      getComputedStyle(document.body).overflowX,
    );
    if (!clippedByViewport && doc.scrollWidth <= doc.clientWidth) return null;

    // Only elements that actually push the DOCUMENT sideways are culprits. A
    // wide table inside an `overflow-x: auto` wrapper has a huge bounding rect
    // but is clipped by its scroller and contributes nothing to the document's
    // scroll width — naming it sends you off fixing the wrong element.
    const clipped = (el: Element): boolean => {
      let n = el.parentElement;
      // Stop BEFORE <body>. When `body { overflow-x: hidden }` propagates to the
      // viewport, body itself answers "hidden" to this walk — so every element
      // on the page reads as clipped, `escaping` is always empty, and the oracle
      // reports nothing at all. A viewport-level clip is the DEFECT, not a
      // legitimate scroller.
      while (n && n !== doc && n !== document.body) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
        n = n.parentElement;
      }
      return false;
    };

    const over = Array.from(document.querySelectorAll('body *'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0 && x.r.right > doc.clientWidth + 1)
      .sort((a, b) => b.r.right - a.r.right);
    const escaping = over.filter((x) => !clipped(x.el));
    if (!escaping.length) return null;
    const widest = escaping[0];
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      widest: widest
        ? `${widest.el.tagName.toLowerCase()}${widest.el.id ? '#' + widest.el.id : ''}` +
          `${widest.el.getAttribute('class') ? '.' + widest.el.getAttribute('class')!.trim().split(/\s+/).join('.') : ''}` +
          ` @${Math.round(widest.r.width)}px right=${Math.round(widest.r.right)}`
        : '(none identified)',
    };
  });
  softExpect(overflow, `page must not scroll horizontally in state: ${label}`);
}

/**
 * Every scrolling container must be operable from the keyboard (WCAG 2.1.1).
 * If it holds no focusable content it needs `tabindex="0"`, so it becomes a
 * focus target arrow keys can then scroll. This lab has three: the graph's pan
 * surface `.atlas-scroll`, the `.table-scroll` around the scale table, and the
 * `.mono-dump` holding all 37 adjacency rows.
 */
export async function expectScrollersReachable(page: Page, label: string): Promise<void> {
  const unreachable = await page.evaluate(() => {
    const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      .filter((el) => {
        const cs = getComputedStyle(el);
        return (
          ['auto', 'scroll'].includes(cs.overflowX) || ['auto', 'scroll'].includes(cs.overflowY)
        );
      })
      .filter((el) => el.tabIndex < 0 && !el.querySelector(FOCUSABLE))
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}` +
          ` (${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight})`
      );
  });
  softExpect(
    Array.from(new Set(unreachable)),
    `scrolling regions with no keyboard route in state: ${label}`
  );
}

/**
 * Scan the page as it currently stands.
 *
 * Five assertions, because axe's `violations` array alone is not a complete
 * oracle:
 *
 *  - `violations` — the usual WCAG A/AA rule failures.
 *  - `incomplete` — axe's "could not decide" bucket, which never reaches the
 *    violations array. The one rule id allowed to remain incomplete is
 *    `color-contrast`, and only because the next assertion computes those
 *    ratios arithmetically. Everything else in that bucket is a real result
 *    axe simply could not finish — including `aria-prohibited-attr`, which is
 *    where an `aria-label` on a role-less div hides, a defect that never
 *    reaches the violations array at all.
 *  - arithmetic contrast — composite-aware WCAG 1.4.3 over every text node.
 *  - keyboard reachability of scrolling regions — WCAG 2.1.1.
 *  - reflow — WCAG 1.4.10, which axe has no rule for at all.
 *
 * WCAG 1.4.11 (non-text contrast) is asserted separately, by
 * `border-contrast.spec.ts`, over every control and every graph stroke — rather
 * than over the one `<select>` that file used to query.
 */
export async function scan(page: Page, label: string): Promise<void> {
  await settle(page);
  await expectNotBlank(page, label);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

  const violations = results.violations.map((v) => ({
    state: label,
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
  }));
  softExpect(violations, `axe violations in state: ${label}`);

  const unexplainedIncomplete = results.incomplete
    .filter((v) => v.id !== 'color-contrast')
    .map((v) => ({
      state: label,
      id: v.id,
      nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
    }));
  softExpect(unexplainedIncomplete, `axe incomplete results in state: ${label}`);

  const contrast = Array.from(new Set(formatContrastFailures(await auditContrast(page))));
  softExpect(contrast, `measured contrast failures in state: ${label}`);

  await expectScrollersReachable(page, label);
  await expectNoHorizontalOverflow(page, label);
}


/** Open a `<details>` the way a visitor does: click its summary. */
async function openDisclosures(page: Page): Promise<void> {
  const summaries = page.locator('#app details:not([open]) > summary');
  for (let i = (await summaries.count()) - 1; i >= 0; i--) {
    await summaries.nth(i).click();
  }
  await expect(page.locator('#app details:not([open])')).toHaveCount(0);
}

/**
 * Exhibit 1 — the atlas itself.
 *
 * Both edge sets are walked, because they are two different graphs: ℓ=2 is
 * 3-regular and ℓ=3 is 4-regular, they draw different numbers of strokes, and
 * every later exhibit computes in whichever one is displayed.
 */
async function driveAtlas(page: Page, theme: string): Promise<void> {
  // A vertex, reached the way the graph itself offers: click the node.
  await page.locator('#atlas-svg .node').first().click();
  await expect(page.locator('#node-info')).toContainText('Model');
  await scan(page, `${theme} / vertex inspected from the graph`);

  // …and the equivalent control, which is a different code path and fills the
  // same panel with a different vertex.
  await page.locator('#sel-inspect').selectOption({ index: 12 });
  await expect(page.locator('#node-info')).toContainText('2-isogenous to');
  await scan(page, `${theme} / vertex inspected from the Inspect menu`);

  // The inspector's own two buttons write into Exhibit 2's endpoints.
  await page.locator('#btn-info-start').click();
  await expect(page.locator('#path-status')).toContainText('Start set to');
  await scan(page, `${theme} / inspector set the search start`);
  await page.locator('#btn-info-target').click();
  await expect(page.locator('#path-status')).toContainText('Target set to');
  await scan(page, `${theme} / inspector set the search target`);

  await page.getByLabel('3-isogenies (4-regular)').check();
  await expect(page.locator('#path-status')).toContainText('3-isogenies');
  await scan(page, `${theme} / 3-isogeny graph (4-regular)`);
  await page.getByLabel('2-isogenies (3-regular)').check();
  await expect(page.locator('#path-status')).toContainText('2-isogenies');
  await scan(page, `${theme} / back to the 2-isogeny graph`);
}

/**
 * Exhibit 2 — the path-finding playground.
 *
 * The manual walk, the armed step-by-step flood layer by layer, the whole-flood
 * run, and both reset paths. The step-by-step search is the one that renders a
 * different status line per layer, so it is scanned per layer rather than once
 * at the end.
 */
async function drivePathfinder(page: Page, theme: string): Promise<void> {
  await page.locator('#btn-walk-self').click();
  await expect(page.locator('#walk-buttons button').first()).toBeVisible();
  await scan(page, `${theme} / manual walk armed, neighbour buttons rendered`);

  await page.locator('#walk-buttons button').first().click();
  await expect(page.locator('#path-status')).not.toHaveText('');
  await scan(page, `${theme} / manual walk, one isogeny taken`);

  await page.locator('#btn-bfs-step').click();
  await expect(page.locator('#path-status')).toContainText('armed');
  await scan(page, `${theme} / step-by-step search armed`);

  // Reveal layers until the search reports a path. Each layer is its own status
  // line and its own set of highlighted frontier vertices.
  for (let i = 0; i < 12; i++) {
    await page.locator('#btn-bfs-step').click();
    const text = (await page.locator('#path-status').innerText()).trim();
    await scan(page, `${theme} / step-by-step search, reveal ${i + 1}`);
    if (/step path|Unreachable/.test(text)) break;
  }
  await expect(page.locator('#path-status')).toContainText('step path');

  await page.locator('#btn-bfs-run').click();
  await expect(page.locator('#path-status')).toContainText('step path', { timeout: 30_000 });
  await expect(page.locator('.status.good')).toBeVisible();
  await scan(page, `${theme} / whole flood run, path found`);

  await page.locator('#btn-shuffle').click();
  await expect(page.locator('#path-status')).toContainText('Target advanced to');
  await scan(page, `${theme} / target advanced`);

  await page.locator('#sel-start').selectOption({ index: 5 });
  await expect(page.locator('#path-status')).toContainText('Endpoints updated');
  await scan(page, `${theme} / endpoints changed from the menus`);

  await page.locator('#btn-clear').click();
  await expect(page.locator('#path-status')).toHaveText('Cleared.');
  await scan(page, `${theme} / search cleared`);
}

/**
 * Exhibit 3 — the seven open problems.
 *
 * Every problem is opened and its widget fired, because each renders a
 * different control set into `#problem-widget` and a different status line:
 * problem 4 adds a slider, problem 5 a text field, and the rest a lone button.
 * The two that take a value are driven to their extremes rather than left at
 * the shipped default.
 */
async function driveTour(page: Page, theme: string): Promise<void> {
  for (let i = 0; i < 7; i++) {
    await page.locator('.tour-nav .num').nth(i).click();
    await expect(page.locator('.tour-nav .num').nth(i)).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('#problem-panel h3')).toContainText(`Problem ${i + 1}`);
    await scan(page, `${theme} / problem ${i + 1} opened`);

    await page.locator('#problem-widget button').first().click();
    await expect(page.locator('#problem-status')).not.toHaveText('', { timeout: 30_000 });
    await scan(page, `${theme} / problem ${i + 1} widget fired`);

    if (i === 3) {
      // The fixed-degree slider. Both ends, not the shipped 4: at k=1 only a
      // handful of curves are endpoints and at k=8 nearly all of them are, so
      // the highlighted set and the status line are entirely different states.
      for (const k of ['1', '8']) {
        await page.locator('#deg-slider').fill(k);
        await expect(page.locator('#problem-status')).toContainText(`length-${k} walks`);
        await scan(page, `${theme} / problem 4, walk length k=${k}`);
      }
    }
    if (i === 4) {
      // The CGL hash. A different message is a different walk, and a very short
      // one exercises the "ran out of legal moves" branch of the status line.
      await page.locator('#hash-msg').fill('a11y drive');
      await page.locator('#problem-widget button').first().click();
      await expect(page.locator('#problem-status')).toContainText('Hashed');
      await scan(page, `${theme} / problem 5, a different message hashed`);
    }
  }

  // The prev/next controls wrap around, which is how a keyboard visitor moves.
  await page.locator('#tour-next').click();
  await expect(page.locator('#problem-panel h3')).toContainText('Problem 1');
  await scan(page, `${theme} / tour wrapped forward to problem 1`);
  await page.locator('#tour-prev').click();
  await expect(page.locator('#problem-panel h3')).toContainText('Problem 7');
  await scan(page, `${theme} / tour wrapped back to problem 7`);
}

/** Drive every state this lab can render, scanning each. */
export async function driveAllStates(page: Page, theme: string): Promise<void> {
  await scan(page, `${theme} / first paint`);

  await page.locator('a.cl-skip-link').focus();
  await scan(page, `${theme} / skip link focused`);

  await driveAtlas(page, theme);
  await drivePathfinder(page, theme);
  await driveTour(page, theme);

  // The expert layer: the derivation notes, the four live self-checks and the
  // full 37-row adjacency dump. Opened by clicking the summaries, never by
  // setting `open` from script.
  await openDisclosures(page);
  await expect(page.locator('#adj-dump')).toBeVisible();
  await expect(page.locator('#self-check-list li')).toHaveCount(4);
  await scan(page, `${theme} / every expert disclosure open`);
}
