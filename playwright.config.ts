import { defineConfig } from '@playwright/test';

// Port 4329: unique across the crypto-lab fleet (grep sibling configs before
// changing). Never 4173 — a shared default port would let reuseExistingServer
// silently scan a different lab's preview.
export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4329/crypto-lab-isogeny-atlas/',
    colorScheme: 'dark',
  },
  webServer: {
    command: 'npm run preview -- --port 4329 --strictPort',
    url: 'http://localhost:4329/crypto-lab-isogeny-atlas/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
