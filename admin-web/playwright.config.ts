import { defineConfig } from '@playwright/test';

/** E2E_PORT and E2E_SERVER=dev let several runs share a machine and test live source without a build. */
const PORT = Number(process.env.E2E_PORT ?? 4173);
const USE_DEV_SERVER = process.env.E2E_SERVER === 'dev';

/** Screen sizes every screen must work at. */
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  laptop: { width: 1280, height: 800 },
  desktop: { width: 1440, height: 900 },
} as const;

export default defineConfig({
  testDir: './e2e',
  // One output folder per port so parallel runs never overwrite each other's traces.
  outputDir: `test-results/port-${PORT}`,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: `playwright-report/port-${PORT}` }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Uses the installed Google Chrome; in CI run `npx playwright install chromium` and drop `channel`.
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: Object.entries(VIEWPORTS).map(([name, viewport]) => ({
    name,
    use: { viewport, isMobile: name === 'mobile', hasTouch: name === 'mobile' || name === 'tablet' },
  })),
  webServer: {
    command: USE_DEV_SERVER
      ? `npx vite --port ${PORT} --strictPort`
      : `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
