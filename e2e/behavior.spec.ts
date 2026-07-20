/**
 * Behavior suite — separate from the axe gate. Asserts graph-mode coherence
 * (the Finding-01 regression from the 2026-07-20 audit), path-edge counts,
 * all seven tour widgets, keyboard operation, and reduced-motion behavior.
 */
import { expect, test, type Page } from '@playwright/test';

const stepCount = (text: string): number => {
  const m = text.match(/(\d+)[- ]step/);
  if (!m) throw new Error(`no step count in: ${text}`);
  return Number(m[1]);
};

const ready = async (page: Page): Promise<void> => {
  await page.goto('.');
  await expect(page.locator('#atlas-status')).toContainText('37 supersingular curves');
};

test('regression (audit 01): tour path highlighting is coherent from the 3-isogeny state', async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel('3-isogenies (4-regular)').check();
  await page.locator('.tour-nav .num').nth(0).click();
  // Opening the tour must snap the displayed edge set (and radio) back to ℓ=2.
  await expect(page.getByLabel('2-isogenies (3-regular)')).toBeChecked();
  await page.locator('#problem-widget button').first().click();
  const status = (await page.locator('#problem-status').textContent()) ?? '';
  const k = stepCount(status);
  // BFS shortest paths are simple, so exactly k distinct edges must light up.
  await expect(page.locator('#atlas-svg .edge.hl-path')).toHaveCount(k);
});

test('regression (audit 01): flipping to 3-isogenies mid-tour, a widget click re-syncs the view', async ({
  page,
}) => {
  await ready(page);
  await page.locator('.tour-nav .num').nth(0).click();
  await page.getByLabel('3-isogenies (4-regular)').check();
  await page.locator('#problem-widget button').first().click();
  await expect(page.getByLabel('2-isogenies (3-regular)')).toBeChecked();
  const status = (await page.locator('#problem-status').textContent()) ?? '';
  await expect(page.locator('#atlas-svg .edge.hl-path')).toHaveCount(stepCount(status));
});

test('exhibit 2: BFS result highlights exactly the reported number of path edges', async ({
  page,
}) => {
  await ready(page);
  await page.locator('#btn-bfs-run').click();
  await expect(page.locator('#path-status')).toContainText('Found a', {
    timeout: 20_000,
  });
  const status = (await page.locator('#path-status').textContent()) ?? '';
  await expect(page.locator('#atlas-svg .edge.hl-path')).toHaveCount(stepCount(status));
});

test('all seven tour widgets produce a result, each entered from the 3-isogeny state', async ({
  page,
}) => {
  await ready(page);
  for (let i = 0; i < 7; i++) {
    await page.getByLabel('3-isogenies (4-regular)').check();
    await page.locator('.tour-nav .num').nth(i).click();
    await expect(page.getByLabel('2-isogenies (3-regular)')).toBeChecked();
    await page.locator('#problem-widget button').first().click();
    await expect(page.locator('#problem-status')).not.toHaveText('', {
      timeout: 15_000,
    });
  }
});

test('model notes are rendered in the expert layer of problems 4, 5, and 7', async ({
  page,
}) => {
  await ready(page);
  for (const i of [3, 4, 6]) {
    await page.locator('.tour-nav .num').nth(i).click();
    await page.locator('#problem-panel details summary').click();
    await expect(page.locator('#problem-panel .model-note')).toContainText(
      'Model note',
    );
  }
});

test('keyboard: a graph vertex is focusable and Enter opens the inspector', async ({
  page,
}) => {
  await ready(page);
  await page.locator('#atlas-svg .node').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#node-info')).toContainText('Model');
});

test('reduced motion: the search reports its result without animation delays', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.locator('#btn-bfs-run').click();
  // No 650 ms-per-layer timer in reduced-motion mode: result is immediate.
  await expect(page.locator('#path-status')).toContainText('Found a', {
    timeout: 1_500,
  });
});
