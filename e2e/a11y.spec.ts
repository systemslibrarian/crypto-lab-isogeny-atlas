import { test } from '@playwright/test';
import { boot, driveAllStates, NARROW, reportCollected } from './gate';

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

for (const theme of ['dark', 'light'] as const) {
  test(`no WCAG A/AA violations in ${theme} theme`, async ({ page }) => {
    test.setTimeout(900_000);
    await boot(page, theme);
    await driveAllStates(page, theme);
    reportCollected();
  });

  test(`no WCAG A/AA violations in ${theme} theme at 380px`, async ({ page }) => {
    test.setTimeout(900_000);
    await page.setViewportSize(NARROW);
    await boot(page, theme);
    await driveAllStates(page, `${theme} @380px`);
    reportCollected();
  });
}
