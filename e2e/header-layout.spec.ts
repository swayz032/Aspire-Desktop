import { expect, test } from '@playwright/test';

import {
  assertNoFatalDiagnostics,
  attachSmokeDiagnostics,
  installSmokeDiagnostics,
} from './smokeHelpers';

const LONG_BUSINESS_NAME = 'T&Scott Remodeling and Construction LLC with Extended Commercial Services Division';

test.describe('Desktop header layout', () => {
  test('long company name stays pinned right and does not collide with search on narrower desktop widths', async ({ page }, testInfo) => {
    const diagnostics = installSmokeDiagnostics(page);

    await page.addInitScript((businessName) => {
      window.localStorage.setItem('aspire.bootstrap.identity', JSON.stringify({
        businessName,
        suiteDisplayId: '129',
        officeDisplayId: '26',
      }));
    }, LONG_BUSINESS_NAME);

    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('smoke-home-root')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('desktop-header-business-name')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('desktop-header-search-bar')).toBeVisible({ timeout: 20_000 });

    const searchBar = await page.getByTestId('desktop-header-search-bar').boundingBox();
    const businessName = await page.getByTestId('desktop-header-business-name').boundingBox();

    expect(searchBar, 'search bar should have a layout box').not.toBeNull();
    expect(businessName, 'business name should have a layout box').not.toBeNull();
    expect(searchBar!.x + searchBar!.width).toBeLessThanOrEqual(businessName!.x - 8);

    await expect(page.getByTestId('desktop-suite-toggle')).toHaveAttribute('aria-label', LONG_BUSINESS_NAME);

    await attachSmokeDiagnostics(testInfo, diagnostics);
    assertNoFatalDiagnostics(diagnostics);
  });
});
