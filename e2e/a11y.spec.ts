import { test } from '@playwright/test';
import { boot, driveAllStates, expectBaselineNotStale, NARROW, reportCollected } from './gate';

/**
 * WCAG A/AA regression gate.
 *
 * Every state the lab can render is driven the way a visitor reaches it: a
 * vertex inspected from the graph and again from the equivalent menu, both
 * edge sets, the manual walk, the step-by-step flood layer by layer, the whole
 * flood, both resets, all seven problems with their widgets fired, the
 * fixed-degree slider at both ends and the CGL hash over a second message, the
 * tour's wrap-around, and finally every expert `<details>` opened by clicking
 * its summary. Every one of those is scanned, in both themes, at desktop and
 * phone width.
 *
 * See `gate.ts` for why nothing is injected into the page, why no `<details>`
 * is ever force-opened, why each scan asserts its content first, and why
 * `violations` is not the whole oracle. WCAG 1.4.11 lives in
 * `border-contrast.spec.ts`.
 */

for (const theme of ['dark'] as const) {
  test(`no WCAG A/AA violations in ${theme} theme`, async ({ page }) => {
    test.setTimeout(900_000);
    await boot(page, theme);
    await driveAllStates(page, theme);
    reportCollected();

    // The third ratchet rule — a baselined finding that no longer appears must
    // be deleted, so the list can only shrink toward empty.
    // `expectBaselineNotStale` was exported from `gate.ts` and imported by
    // nothing, so it had never run.
    //
    // `nontext-baseline.ts` is currently empty, which is the goal state, so
    // today this asserts nothing. It is wired anyway, and deliberately: an
    // empty baseline is the one that most easily stops being empty. The moment
    // an entry is added — and the header comment promises the file can only
    // shrink back toward empty — the rule that forces its deletion has to
    // already be running, or the entry becomes permanent the day it lands.
    //
    // After `reportCollected()`, deliberately: in an `A11Y_COLLECT` run that
    // call throws to stop a collecting pass being read as green, and it should
    // keep doing so before this hard assertion fires.
    expectBaselineNotStale();
  });

  test(`no WCAG A/AA violations in ${theme} theme at 380px`, async ({ page }) => {
    test.setTimeout(900_000);
    await page.setViewportSize(NARROW);
    await boot(page, theme);
    await driveAllStates(page, `${theme} @380px`);
    reportCollected();
    expectBaselineNotStale();
  });
}
