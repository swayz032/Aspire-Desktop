import { defineConfig, devices } from '@playwright/test';

const port = process.env.E2E_PORT || '4173';
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/playwright-smoke.json' }],
  ],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  webServer: process.env.E2E_SKIP_WEBSERVER === 'true'
    ? undefined
    : {
        command: 'node scripts/start-e2e-server.mjs',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 900_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
