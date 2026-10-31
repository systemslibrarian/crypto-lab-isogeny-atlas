import {test,expect} from '@playwright/test';
test('research boundary is visible in the rendered lesson',async({page})=>{
 await page.goto('./');
 await expect(page.locator('body')).toContainText('generic graph search'); await expect(page.locator('body')).toContainText('both endpoint'); await expect(page.locator('body')).toContainText('unrefereed preprint');
});

test('both path-related lessons expose the revised concrete-cost limits and source', async ({ page }) => {
  await page.goto('./');
  for (const n of [1, 3]) {
    await page.getByRole('button', { name: new RegExp(`^Problem ${n}:`) }).click();
    await page.locator('#problem-panel summary').click();
    const note = page.locator('#problem-panel .isogeny-cost-update');
    await expect(note).toBeVisible();
    await expect(note).toContainText('30 October 2026');
    await expect(note).toContainText('preprint');
    await expect(note).toContainText('practical memory ranges');
    await expect(note).toContainText('parallelization');
    await expect(note).toContainText('not demonstrated production SQIsign key recovery');
    await expect(note.locator('a')).toHaveAttribute('href', 'https://eprint.iacr.org/2026/1821');
  }
});
