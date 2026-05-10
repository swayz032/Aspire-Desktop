/**
 * Tablet Smoke Suite
 *
 * Runs across all 6 tablet Playwright projects (see playwright.config.ts).
 * Each test:
 *   1. Navigates to the target route
 *   2. Waits for the page to settle (domcontentloaded + short networkidle drain)
 *   3. Asserts no fatal console/page errors
 *   4. Asserts no horizontal overflow (classic tablet layout regression)
 *   5. Saves a visual screenshot as a baseline artefact
 *
 * Auth: Protected routes require a live session. We inject a Supabase access
 * token via localStorage when E2E_SUPABASE_TOKEN is set. If the env var is
 * absent the test navigates anyway — the redirect to /login is expected and
 * the test records that state in the screenshot + skips the overflow check on
 * the login redirect page.
 *
 * Total runs when all 6 tablet projects execute: 10 screens × 6 viewports = 60
 */

import * as fs from 'fs';
import * as path from 'path';

import { expect, Page, test } from '@playwright/test';

import { injectAuthIfAvailable } from './fixtures';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScreenEntry {
  id: string;
  /** Human-readable label used in screenshot filenames and test names. */
  label: string;
  path: string;
  /** If true, the route requires auth. Tests will attempt token injection. */
  requiresAuth: boolean;
}

interface TabletDiagnostics {
  consoleErrors: string[];
  pageErrors: string[];
}

// ── Screen registry — the 10 tablet-risk screens ─────────────────────────────

const TABLET_SCREENS: ScreenEntry[] = [
  { id: 'landing',      label: 'Landing',             path: '/',                    requiresAuth: false },
  { id: 'login',        label: 'Login',               path: '/login',               requiresAuth: false },
  { id: 'inbox',        label: 'Inbox',               path: '/(tabs)/inbox',        requiresAuth: true  },
  { id: 'finance-hub',  label: 'Finance Hub',         path: '/finance-hub',         requiresAuth: true  },
  { id: 'founder-hub',  label: 'Founder Hub',         path: '/founder-hub',         requiresAuth: true  },
  { id: 'calls',        label: 'Calls',               path: '/session/calls',       requiresAuth: true  },
  { id: 'conference',   label: 'Conference',          path: '/session/conference',  requiresAuth: true  },
  { id: 'video',        label: 'Video',               path: '/session/video',       requiresAuth: true  },
  { id: 'more',         label: 'More Menu',           path: '/more',                requiresAuth: true  },
  { id: 'integrations', label: 'Integrations',        path: '/more/integrations',   requiresAuth: true  },
];

// ── Severe console patterns (same set used in desktop smokeHelpers.ts) ────────

const SEVERE_PATTERNS: RegExp[] = [
  /uncaught/i,
  /typeerror/i,
  /referenceerror/i,
  /rangeerror/i,
  /syntaxerror/i,
  /maximum update depth exceeded/i,
  /minified react error/i,
  /hydration/i,
  /not a function/i,
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function installDiagnostics(page: Page): TabletDiagnostics {
  const diag: TabletDiagnostics = { consoleErrors: [], pageErrors: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') diag.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    diag.pageErrors.push(err.message);
  });
  return diag;
}

/**
 * Inject a Supabase session token into localStorage so protected routes don't
 * immediately redirect to /login during the smoke run.
 *
 * Requires E2E_SUPABASE_TOKEN (access_token) and E2E_SUPABASE_REFRESH (optional).
 * If the env vars are absent the injection is skipped — tests will hit the login
 * redirect instead and we record that in the screenshot.
 *
 * TODO: Replace this stub with a proper Playwright storageState fixture once the
 * dev bypass pattern (`?e2eRoute=...`) is extended to authenticated routes.
 */
// injectAuthIfAvailable moved to ./fixtures so it's shared across the suite.

function screenshotDir(projectName: string): string {
  return path.join(
    __dirname,
    '__screenshots__',
    // Sanitize project name for filesystem safety
    projectName.replace(/[^a-z0-9-]/gi, '_'),
  );
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Tablet smoke — layout + overflow + error-free', () => {
  for (const screen of TABLET_SCREENS) {
    test(`${screen.id} | ${screen.label}`, async ({ page, baseURL }, testInfo) => {
      const diag = installDiagnostics(page);
      const projectName = testInfo.project.name;

      // Auth injection (no-op when env var is absent)
      if (screen.requiresAuth) {
        await injectAuthIfAvailable(page, baseURL ?? '');
      }

      // ── Navigate ──────────────────────────────────────────────────────────
      const response = await page.goto(screen.path, { waitUntil: 'domcontentloaded' });

      // Drain network activity — ignore timeout (SPAs rarely reach idle cleanly)
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
      // Short settle so client-side routing can complete
      await page.waitForTimeout(1_500);

      // ── Screenshot ────────────────────────────────────────────────────────
      const dir = screenshotDir(projectName);
      ensureDir(dir);
      const screenshotPath = path.join(dir, `${screen.id}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      await testInfo.attach(`screenshot-${screen.id}`, {
        path: screenshotPath,
        contentType: 'image/png',
      });

      // ── Horizontal-scroll check ───────────────────────────────────────────
      // Detects overflow that causes horizontal scrollbars on tablets — a
      // classic mobile/tablet layout regression caused by fixed-width elements,
      // non-responsive containers, or desktop-only CSS.
      //
      // We skip this assertion if the app redirected us to /login (auth guard
      // fired) because the login page is already covered by its own entry and
      // we don't want a false failure on the redirect destination.
      const finalURL = page.url();
      const wasRedirectedToLogin =
        screen.requiresAuth && finalURL.includes('/login') && !screen.path.includes('/login');

      if (!wasRedirectedToLogin) {
        const hasHorizontalOverflow = await page.evaluate(() => {
          const html = document.documentElement;
          return html.scrollWidth > html.clientWidth;
        });
        expect(
          hasHorizontalOverflow,
          `Horizontal overflow detected on ${screen.label} (${screen.path}) — scrollWidth > clientWidth`,
        ).toBe(false);
      }

      // ── Console / page error assertions ───────────────────────────────────
      const severeErrors = diag.consoleErrors.filter((msg) =>
        SEVERE_PATTERNS.some((p) => p.test(msg)),
      );

      // Attach diagnostics even on pass so failures have context
      if (diag.consoleErrors.length > 0) {
        await testInfo.attach('console-errors', {
          body: Buffer.from(diag.consoleErrors.join('\n\n'), 'utf8'),
          contentType: 'text/plain',
        });
      }
      if (diag.pageErrors.length > 0) {
        await testInfo.attach('page-errors', {
          body: Buffer.from(diag.pageErrors.join('\n\n'), 'utf8'),
          contentType: 'text/plain',
        });
      }

      expect(
        { pageErrors: diag.pageErrors, severeConsoleErrors: severeErrors },
        `Fatal runtime diagnostics on ${screen.label} [${projectName}]`,
      ).toEqual({ pageErrors: [], severeConsoleErrors: [] });

      // ── HTTP response sanity ──────────────────────────────────────────────
      // A 500 from the server is always a blocker regardless of auth state.
      if (response && response.status() >= 500) {
        throw new Error(
          `Server returned HTTP ${response.status()} for ${screen.path} on [${projectName}]`,
        );
      }
    });
  }
});
