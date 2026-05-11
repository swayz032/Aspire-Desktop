/**
 * Tablet Landing Page Suite
 *
 * Verifies the public marketing landing page renders correctly across all 6
 * tablet Playwright projects (iPad portrait/landscape, Android portrait/landscape,
 * mini and mid sizes — see playwright.config.ts).
 *
 * Acceptance:
 *   1. The PAGE BODY does not horizontally overflow (html.scrollWidth <= clientWidth).
 *      The CockpitMockup container is allowed to scroll internally — that is
 *      the explicit design choice (mockup is 1036px scaled, larger than iPad
 *      portrait — we let the user pan inside the mockup container instead of
 *      shrinking the visual or breaking the page).
 *   2. No fatal console / page errors.
 *   3. Landing root smoke marker is present.
 *
 * Total runs: 1 screen × 6 viewports = 6.
 */

import { expect, Page, test } from '@playwright/test';

interface Diagnostics {
  consoleErrors: string[];
  pageErrors: string[];
}

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

function installDiagnostics(page: Page): Diagnostics {
  const diag: Diagnostics = { consoleErrors: [], pageErrors: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') diag.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    diag.pageErrors.push(err.message);
  });
  return diag;
}

test.describe('Tablet — Landing/Marketing site', () => {
  test('landing renders without horizontal page overflow', async ({ page }, testInfo) => {
    const diag = installDiagnostics(page);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(1_500);

    // Smoke marker — landing root mounted (not redirected to /(tabs))
    const root = page.locator('[data-testid="smoke-landing-root"]');
    await expect(root, 'landing root must mount on public visit').toBeVisible({ timeout: 8_000 });

    // PAGE-LEVEL horizontal overflow check.
    // Internal scrollable containers (e.g. the CockpitMockup wrapper) are
    // intentional and do NOT contribute to documentElement.scrollWidth as long
    // as their parent has overflow constraints — which #smoke-landing-root does
    // via overflowX: 'hidden'.
    const hasHorizontalOverflow = await page.evaluate(() => {
      const html = document.documentElement;
      return html.scrollWidth > html.clientWidth + 1; // 1px tolerance for sub-pixel rounding
    });
    expect(
      hasHorizontalOverflow,
      `Landing page body overflows horizontally on ${testInfo.project.name} ` +
        `(html.scrollWidth > clientWidth). Mockup container is allowed to scroll ` +
        `internally — page body must not.`,
    ).toBe(false);

    // Fatal error gate
    const severe = diag.consoleErrors.filter((m) => SEVERE_PATTERNS.some((p) => p.test(m)));
    if (diag.consoleErrors.length > 0) {
      await testInfo.attach('console-errors', {
        body: Buffer.from(diag.consoleErrors.join('\n\n'), 'utf8'),
        contentType: 'text/plain',
      });
    }
    expect(
      { pageErrors: diag.pageErrors, severeConsoleErrors: severe },
      `Fatal runtime diagnostics on landing [${testInfo.project.name}]`,
    ).toEqual({ pageErrors: [], severeConsoleErrors: [] });
  });

  test('landing nav links are tappable (>= 44pt hit area)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1_000);

    // All nav links + CTAs use the .aspire-nav-link / .aspire-nav-cta classes
    // and have minHeight: 44 inline. Spot-check the first nav link.
    const links = page.locator('.aspire-nav-link, .aspire-nav-cta');
    const count = await links.count();
    expect(count, 'at least 4 nav links + 2 CTAs expected on landing').toBeGreaterThanOrEqual(5);

    for (let i = 0; i < count; i++) {
      const box = await links.nth(i).boundingBox();
      if (!box) continue; // hidden — skip
      expect(
        box.height,
        `nav link/CTA index ${i} must be >= 44pt tall for tablet tap target`,
      ).toBeGreaterThanOrEqual(44);
    }
  });
});
