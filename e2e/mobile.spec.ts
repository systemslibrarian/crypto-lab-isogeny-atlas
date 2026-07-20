/**
 * Mobile suite (390 × 844, touch): the Finding-03 acceptance criteria from the
 * 2026-07-20 audit. Runs under the mobile-chromium project only.
 */
import { expect, test, type Page } from '@playwright/test';

const ready = async (page: Page): Promise<void> => {
  await page.goto('.');
  await expect(page.locator('#atlas-status')).toContainText('37 supersingular curves');
};

test('vertex touch targets are at least 24 CSS px on a phone', async ({ page }) => {
  await ready(page);
  const hits = page.locator('#atlas-svg .node-hit');
  const count = await hits.count();
  expect(count).toBe(37);
  for (const i of [0, 9, 18, 27, 36]) {
    const box = await hits.nth(i).boundingBox();
    expect(box, `hit region ${i} has a bounding box`).not.toBeNull();
    expect(box!.width, `hit region ${i} width`).toBeGreaterThanOrEqual(24);
    expect(box!.height, `hit region ${i} height`).toBeGreaterThanOrEqual(24);
  }
});

test('the graph pans inside its own panel — no page-level horizontal overflow', async ({
  page,
}) => {
  await ready(page);
  const overflow = await page.evaluate(() => {
    const doc = document.scrollingElement!;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
  // and the panel itself really is the scroll surface
  const panelScrolls = await page.evaluate(() => {
    const panel = document.querySelector('.atlas-scroll')!;
    return panel.scrollWidth > panel.clientWidth;
  });
  expect(panelScrolls).toBe(true);
});

test('every curve is inspectable without precision tapping via the Inspect menu', async ({
  page,
}) => {
  await ready(page);
  const select = page.locator('#sel-inspect');
  const box = await select.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(24);
  await select.selectOption('5');
  await expect(page.locator('#node-info')).toContainText('Model');
  await select.selectOption('36');
  await expect(page.locator('#node-info')).toContainText('Model');
});

test('a vertex can also be tapped directly', async ({ page }) => {
  await ready(page);
  const node = page.locator('#atlas-svg .node').nth(18);
  // Center it first: Playwright's minimal scroll can leave the target under
  // the sticky site header, which then swallows the tap.
  await node.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
  await node.tap();
  await expect(page.locator('#node-info')).toContainText('Model');
});
