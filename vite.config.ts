/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/crypto-lab-isogeny-atlas/',
  test: {
    // Playwright specs live in e2e/ and must not be collected by Vitest.
    include: ['src/**/*.test.ts'],
  },
});
