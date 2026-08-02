import { defineConfig } from '@playwright/test';

// Port 4329: unique across the crypto-lab fleet (grep sibling configs before
// changing). Never 4173 — a shared default port would let reuseExistingServer
// silently scan a different lab's preview.
export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  // The a11y suite deliberately drives every exhibit into its post-interaction
  // state before scanning, and a full light-theme scan has been measured near
  // 60 s; Playwright's 30 s default made the gate flaky. 120 s is headroom,
  // not laziness.
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:4329/crypto-lab-isogeny-atlas/',
    colorScheme: 'dark',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: 'mobile-chromium',
      testMatch: /mobile\.spec\.ts/,
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    // Build before serving. `preview` only serves whatever is already in
    // dist/; without the build in front, a failing build leaves the previous
    // good bundle on disk and the suite passes green against code that no
    // longer compiles — silently invalidating mutation checks.
    command: 'npm run build && npm run preview -- --port 4329 --strictPort',
    url: 'http://localhost:4329/crypto-lab-isogeny-atlas/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
