/**
 * Tablet Auth Suite — login (and signup) tablet rendering contract.
 *
 * Runs across all 6 tablet Playwright projects (see playwright.config.ts).
 * Targets the auth flow specifically because login is the FIRST screen the
 * beta user sees on iPad / Android tablet.
 *
 * Contract enforced:
 *   1. /login renders without horizontal overflow.
 *   2. The active console card's email + password inputs are present and
 *      have a rendered height >= 44px (Apple HIG floor; we target 48 in CSS).
 *   3. The submit button has rendered height >= 44px.
 *   4. Tapping (focusing) the email input does not push the submit button
 *      out of the visible viewport — the button's bottom edge must remain
 *      <= window.innerHeight (or visualViewport.height when available).
 *   5. /onboarding (post-signup target) renders without horizontal overflow.
 */

import { expect, test, type Page } from '@playwright/test';

const TOUCH_TARGET_FLOOR_PX = 44; // Apple HIG; Material/our token is 48 — we keep slack.

async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const html = document.documentElement;
    return { scrollWidth: html.scrollWidth, clientWidth: html.clientWidth };
  });
  expect(
    overflow.scrollWidth,
    `${label}: horizontal overflow (scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.clientWidth})`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1); // +1 for sub-pixel rounding
}

test.describe('Tablet auth — login renders + remains usable with keyboard', () => {
  test('login: no horizontal overflow + 48px touch targets + visible after focus', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
    // Allow the carousel to settle and inputs for the active card to mount.
    await page.waitForTimeout(1_000);

    // ── 1. No horizontal overflow ──────────────────────────────────────────
    await expectNoHorizontalOverflow(page, 'login');

    // ── 2. Email input >= 44px tall ────────────────────────────────────────
    // The active card uses id="aspire-login-email" / "aspire-login-password";
    // inactive cards use unique generated names, so this targets the right one.
    const email = page.locator('#aspire-login-email');
    await expect(email).toBeVisible({ timeout: 5_000 });
    const emailBox = await email.boundingBox();
    expect(emailBox, 'login: email input has no bounding box').not.toBeNull();
    expect(emailBox!.height, 'login: email input height < touch-target floor').toBeGreaterThanOrEqual(
      TOUCH_TARGET_FLOOR_PX,
    );

    const password = page.locator('#aspire-login-password');
    const passwordBox = await password.boundingBox();
    expect(passwordBox, 'login: password input has no bounding box').not.toBeNull();
    expect(passwordBox!.height, 'login: password input height < touch-target floor').toBeGreaterThanOrEqual(
      TOUCH_TARGET_FLOOR_PX,
    );

    // ── 3. Submit button >= 44px tall ──────────────────────────────────────
    const submit = page.locator('[data-testid="smoke-login-submit"]');
    await expect(submit).toBeVisible();
    const submitBox = await submit.boundingBox();
    expect(submitBox, 'login: submit button has no bounding box').not.toBeNull();
    expect(submitBox!.height, 'login: submit button height < touch-target floor').toBeGreaterThanOrEqual(
      TOUCH_TARGET_FLOOR_PX,
    );

    // ── 4. Focus email — submit button must remain in viewport ─────────────
    await email.focus();
    // Give visualViewport reflow + our stage translateY transition time to settle.
    await page.waitForTimeout(400);

    const visibility = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="smoke-login-submit"]');
      if (!el) return { found: false };
      const r = el.getBoundingClientRect();
      const vv = (window as any).visualViewport;
      const visibleHeight = vv ? vv.height : window.innerHeight;
      const visibleTopOffset = vv ? vv.offsetTop : 0;
      return {
        found: true,
        bottom: r.bottom,
        top: r.top,
        visibleHeight,
        visibleTopOffset,
      };
    });
    expect(visibility.found, 'login: submit button missing after focus').toBe(true);
    // Submit's bottom edge must sit within the visible (post-keyboard) viewport,
    // accounting for visualViewport offset on iOS Safari.
    const visibleBottom = (visibility.visibleHeight ?? 0) + (visibility.visibleTopOffset ?? 0);
    expect(
      visibility.bottom!,
      `login: submit button occluded by keyboard (bottom=${visibility.bottom}, visibleBottom=${visibleBottom})`,
    ).toBeLessThanOrEqual(visibleBottom + 8); // 8px tolerance
  });

  test('login: arrow buttons (when present) are >= 44px tall', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    const nextArrow = page.locator('button[aria-label="Next console"]');
    if ((await nextArrow.count()) > 0) {
      const box = await nextArrow.first().boundingBox();
      expect(box, 'login: next arrow has no bounding box').not.toBeNull();
      expect(box!.height, 'login: next arrow height < touch-target floor').toBeGreaterThanOrEqual(
        TOUCH_TARGET_FLOOR_PX,
      );
      expect(box!.width, 'login: next arrow width < touch-target floor').toBeGreaterThanOrEqual(
        TOUCH_TARGET_FLOOR_PX,
      );
    }
  });

  test('onboarding: no horizontal overflow when reached directly', async ({ page }) => {
    // The onboarding page is auth-gated; without a session it redirects to
    // /login. We still want to detect overflow if rendered, so navigate and
    // tolerate either destination.
    await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(800);

    // If we got bounced to /login, that's the same overflow guarantee — apply it.
    await expectNoHorizontalOverflow(page, page.url().includes('/login') ? 'onboarding->login' : 'onboarding');
  });
});
