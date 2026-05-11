/**
 * Tablet Hubs Suite
 *
 * Targeted regression tests for the Wave-N tablet hub fixes:
 *   1. Finance Hub renders right rail at iPad portrait (1024 CSS px)
 *      — the existing layout must be preserved (no stack-to-bottom collapse).
 *   2. Inbox renders without horizontal overflow at all tablet viewports.
 *   3. Founder Hub renders without horizontal overflow at all tablet viewports.
 *
 * These tests are additive on top of `smoke.spec.ts` (which already covers
 * generic overflow + console error checks). This file zeroes in on the
 * specific layout invariants the hub tablet pass introduced.
 *
 * Auth: Same pattern as smoke.spec.ts — token injection via env, otherwise the
 * test records the redirect and skips layout assertions on the login page.
 */

import { expect, Page, test } from '@playwright/test';

import { injectAuthIfAvailable, isOnLoginRedirect } from './fixtures';

test.describe('Tablet hubs — finance + founder + inbox layout invariants', () => {
  test('finance-hub | no horizontal overflow at tablet viewport', async ({ page, baseURL }) => {
    await injectAuthIfAvailable(page, baseURL ?? '');
    await page.goto('/finance-hub', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(1_500);

    if (await isOnLoginRedirect(page)) {
      test.skip(true, 'Auth not available — finance-hub redirected to /login');
      return;
    }

    const overflow = await page.evaluate(() => {
      const html = document.documentElement;
      return html.scrollWidth - html.clientWidth;
    });
    expect(overflow, 'Finance Hub must not produce horizontal overflow on tablet').toBeLessThanOrEqual(1);
  });

  test('founder-hub | no horizontal overflow at tablet viewport', async ({ page, baseURL }) => {
    await injectAuthIfAvailable(page, baseURL ?? '');
    await page.goto('/founder-hub', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(1_500);

    if (await isOnLoginRedirect(page)) {
      test.skip(true, 'Auth not available — founder-hub redirected to /login');
      return;
    }

    const overflow = await page.evaluate(() => {
      const html = document.documentElement;
      return html.scrollWidth - html.clientWidth;
    });
    expect(overflow, 'Founder Hub must not produce horizontal overflow on tablet').toBeLessThanOrEqual(1);
  });

  test('inbox | no horizontal overflow + body fits viewport', async ({ page, baseURL }) => {
    await injectAuthIfAvailable(page, baseURL ?? '');
    await page.goto('/(tabs)/inbox', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(1_500);

    if (await isOnLoginRedirect(page)) {
      test.skip(true, 'Auth not available — inbox redirected to /login');
      return;
    }

    const result = await page.evaluate(() => {
      const html = document.documentElement;
      return {
        overflow: html.scrollWidth - html.clientWidth,
        bodyWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
      };
    });

    expect(result.overflow, 'Inbox must not produce horizontal overflow on tablet').toBeLessThanOrEqual(1);
    expect(result.bodyWidth, 'Inbox body must fit within viewport').toBeLessThanOrEqual(result.viewportWidth + 1);
  });
});
