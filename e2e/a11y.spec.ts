/**
 * WCAG 2.1 A/AA regression gate (axe-core), both themes, against the
 * production build. driveDemos() walks EVERY interactive surface into its
 * post-interaction state before scanning — an unscanned state is an ungated
 * state, and dynamic result regions are where violations hide.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function driveDemos(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `*,*::before,*::after{animation:none!important;transition:none!important}`,
  });
  // The graph is computed live at load; wait for the status line to prove it.
  await expect(page.locator('#atlas-status')).toContainText('37 supersingular curves');

  // Exhibit 1 — inspect a vertex (fills the node inspector), both edge sets.
  await page.locator('#atlas-svg .node').first().click();
  await expect(page.locator('#node-info')).toContainText('Model');
  await page.getByLabel('3-isogenies (4-regular)').check();
  await page.getByLabel('2-isogenies (3-regular)').check();

  // Exhibit 2 — manual walk (renders neighbor buttons), one hop, then BFS.
  await page.locator('#btn-walk-self').click();
  await expect(page.locator('#walk-buttons button').first()).toBeVisible();
  await page.locator('#walk-buttons button').first().click();
  await page.locator('#btn-bfs-step').click(); // arm
  await page.locator('#btn-bfs-step').click(); // layer 0
  await page.locator('#btn-bfs-run').click();
  await expect(page.locator('#path-status')).toContainText('path', { timeout: 20_000 });
  await page.locator('#btn-shuffle').click();
  await page.locator('#btn-clear').click();

  // Exhibit 3 — visit all seven problems and fire each widget.
  for (let i = 0; i < 7; i++) {
    await page.locator('.tour-nav .num').nth(i).click();
    const widgetButton = page.locator('#problem-widget button').first();
    await widgetButton.click();
    await expect(page.locator('#problem-status')).not.toHaveText('', {
      timeout: 15_000,
    });
    if (i === 3) {
      // fixed-degree slider
      await page.locator('#deg-slider').fill('7');
    }
    if (i === 4) {
      // hash a fresh message and re-walk
      await page.locator('#hash-msg').fill('a11y drive');
      await widgetButton.click();
    }
  }

  // Open every <details> so the expert layer is scanned too.
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => {
      d.open = true;
    });
  });
  await page.waitForTimeout(300);
}

async function scan(page: Page, label: string): Promise<void> {
  const t0 = Date.now();
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  console.log(`axe scan (${label}): ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  expect(
    violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
    })),
  ).toEqual([]);
}

test('no WCAG A/AA violations — dark theme', async ({ page }) => {
  await page.goto('.');
  await driveDemos(page);
  await scan(page, 'dark');
});

test('no WCAG A/AA violations — light theme', async ({ page }) => {
  await page.goto('.');
  await page.locator('#cl-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await driveDemos(page);
  await scan(page, 'light');
});
