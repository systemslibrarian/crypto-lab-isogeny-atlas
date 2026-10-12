import {test,expect} from '@playwright/test';
test('research boundary is visible in the rendered lesson',async({page})=>{
 await page.goto('./');
 await expect(page.locator('body')).toContainText('generic graph search'); await expect(page.locator('body')).toContainText('both endpoint'); await expect(page.locator('body')).toContainText('unrefereed preprint');
});
