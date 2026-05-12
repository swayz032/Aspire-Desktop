/**
 * Front Desk Hub -- Pass 1 skeleton smoke tests (scope-limited).
 *
 * Verifies ONLY the Pass 1 skeleton contract:
 *   1. Route loads at 4 viewport configurations (handled by Playwright projects)
 *   2. HTTP 200 or redirect (no 5xx from server)
 *   3. No fatal console errors (TypeError, ReferenceError, React crash, etc.)
 *   4. Page title element "Front Desk" renders
 *   5. No horizontal page overflow
 *
 * Playwright projects that will run this (from playwright.config.ts testMatch):
 *   - ipad-portrait, ipad-landscape (WebKit + iPad UA)
 *   - ipad-pro-12-portrait, ipad-pro-12-landscape (WebKit)
 *   - android-tablet-landscape, android-tablet-portrait (Chromium + Android UA)
 *
 * Note: The 'chromium' (desktop) project has testIgnore for the tablet subfolder so it
 * will NOT run this file. The desktop chromium check can be done by adding a
 * separate entry in e2e/ root if needed in a future pass.
 *
 * Auth: Route is protected. Token injected via injectAuthIfAvailable from
 * E2E_SUPABASE_TOKEN env var. If absent, the route redirects to /login and
 * we skip content assertions gracefully (does NOT fail the test).
 *
 * Pass 2-5 (cards, SMS, backend) are NOT covered here per scope restriction.
 *
 * Part of feat/front-desk-hub Pass 1 verification (2026-05-11).
 */

import { expect, Page, test } from '@playwright/test';

import { injectAuthIfAvailable, isOnLoginRedirect } from './fixtures';

const SEVERE_PATTERNS: RegExp[] = [
  /uncaught/i,
  /typeerror/i,
  /referenceerror/i,
  /rangeerror/i,
  /syntaxerror/i,
  /maximum update depth exceeded/i,
  /minified react error/i,
  /not a function/i,
];

interface Diagnostics {
  consoleErrors: string[];
  pageErrors: string[];
}

function installDiagnostics(page: Page): Diagnostics {
  const diag: Diagnostics = { consoleErrors: [], pageErrors: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') diag.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => diag.pageErrors.push(err.message));
  return diag;
}

const FRONT_DESK_PATH = '/session/front-desk';

test.describe('Front Desk Hub -- Pass 1 skeleton render smoke', () => {
  test('loads without crash -- no fatal errors, title renders, no overflow', async ({
    page,
    baseURL,
  }, testInfo) => {
    const diag = installDiagnostics(page);

    await injectAuthIfAvailable(page, baseURL ?? '');

    const response = await page.goto(FRONT_DESK_PATH, {
      waitUntil: 'domcontentloaded',
    });

    // Drain network (SPA may not reach networkidle -- ignore timeout)
    await page.waitForLoadState('networkidle', { timeout: 6_000 }).catch(() => undefined);
    // Let client-side routing settle
    await page.waitForTimeout(1_500);

    // HTTP status -- 5xx is always a blocker
    if (response && response.status() >= 500) {
      throw new Error(
        'Server returned HTTP ' + response.status() + ' for ' + FRONT_DESK_PATH +
          ' on [' + testInfo.project.name + ']',
      );
    }

    // Auth redirect guard
    if (await isOnLoginRedirect(page)) {
      test.skip(
        true,
        'E2E_SUPABASE_TOKEN not set -- front-desk redirected to /login. ' +
          'Set the env var to exercise authenticated content.',
      );
      return;
    }

    // Page title element -- FrontDeskHeader renders "Front Desk" at fontSize 26
    const titleEl = page.getByText('Front Desk', { exact: true }).first();
    await expect(titleEl).toBeVisible({ timeout: 10_000 });

    // No horizontal overflow
    const overflow = await page.evaluate(() => {
      const html = document.documentElement;
      return html.scrollWidth - html.clientWidth;
    });
    expect(
      overflow,
      'Horizontal overflow detected on Front Desk Hub [' + testInfo.project.name + '] ' +
        '-- scrollWidth > clientWidth by ' + overflow + 'px',
    ).toBeLessThanOrEqual(1);

    // Fatal error assertions
    const severeErrors = diag.consoleErrors.filter((msg) =>
      SEVERE_PATTERNS.some((p) => p.test(msg)),
    );

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
      'Fatal runtime diagnostics on Front Desk Hub [' + testInfo.project.name + ']',
    ).toEqual({ pageErrors: [], severeConsoleErrors: [] });
  });
});
