import { defineConfig, devices } from '@playwright/test';

const port = process.env.E2E_PORT || '4173';
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;

// Safari UA used for all iPad Pro profiles
const IPAD_PRO_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

// Chrome UA used for Android tablet profiles (Galaxy Tab S8+)
const ANDROID_TABLET_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-X806B) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

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
    // ── Desktop (existing) ────────────────────────────────────────────────────
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Desktop specs live directly in e2e/ — exclude tablet subfolder
      testIgnore: '**/tablet/**',
    },

    // ── iPad Pro 11" — uses official Playwright profile ──────────────────────
    {
      name: 'ipad-portrait',
      use: {
        ...devices['iPad Pro 11'],
        // Override UA to iOS 17 for 2026 beta coverage
        userAgent: IPAD_PRO_UA,
      },
      testMatch: '**/tablet/*.spec.ts',
    },
    {
      name: 'ipad-landscape',
      use: {
        ...devices['iPad Pro 11 landscape'],
        userAgent: IPAD_PRO_UA,
      },
      testMatch: '**/tablet/*.spec.ts',
    },

    // ── iPad Pro 12.9" — no official profile; constructed manually ────────────
    {
      name: 'ipad-pro-12-portrait',
      use: {
        viewport: { width: 1024, height: 1366 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: IPAD_PRO_UA,
        defaultBrowserType: 'webkit',
      },
      testMatch: '**/tablet/*.spec.ts',
    },
    {
      name: 'ipad-pro-12-landscape',
      use: {
        viewport: { width: 1366, height: 1024 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: IPAD_PRO_UA,
        defaultBrowserType: 'webkit',
      },
      testMatch: '**/tablet/*.spec.ts',
    },

    // ── Galaxy Tab S8+ — constructed manually (1280×800 CSS px) ──────────────
    {
      name: 'android-tablet-landscape',
      use: {
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: ANDROID_TABLET_UA,
        defaultBrowserType: 'chromium',
      },
      testMatch: '**/tablet/*.spec.ts',
    },
    {
      name: 'android-tablet-portrait',
      use: {
        viewport: { width: 800, height: 1280 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: ANDROID_TABLET_UA,
        defaultBrowserType: 'chromium',
      },
      testMatch: '**/tablet/*.spec.ts',
    },
  ],
});
