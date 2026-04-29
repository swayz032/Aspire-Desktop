import { expect, test, type Page } from '@playwright/test';

import {
  assertNoFatalDiagnostics,
  attachSmokeDiagnostics,
  installSmokeDiagnostics,
} from './smokeHelpers';

const DEMO_PATH = '/demo/research-modal';

async function gotoDemo(page: Page, query = '') {
  await page.goto(`${DEMO_PATH}${query}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('research-modal-demo-root')).toBeVisible({ timeout: 45_000 });
  // Modal mounts asynchronously after useAvaPresents.showCards() runs in useEffect.
  await expect(page.getByTestId('research-modal')).toBeVisible({ timeout: 20_000 });
  // Allow entry animation + perspective transforms to settle.
  await page.waitForTimeout(900);
}

/**
 * Read computed opacity of a card by testID. Returns 0..1.
 * Used to verify peek-card visibility (~0.55) vs. hidden (~0).
 */
async function cardOpacity(page: Page, index: number): Promise<number> {
  return page.getByTestId(`research-modal-card-${index}`).evaluate(
    (el) => Number(window.getComputedStyle(el as HTMLElement).opacity),
  );
}

/**
 * Read the data-card-active attribute value on a card. Returns 'true' | 'false'.
 * RN-Web converts dataSet={{ cardActive: 'true' }} → data-card-active="true".
 */
async function cardActiveAttr(page: Page, index: number): Promise<string | null> {
  return page.getByTestId(`research-modal-card-${index}`).getAttribute('data-card-active');
}

test.describe('ResearchModal — 3D perspective carousel', () => {
  test('mounts 3 cards with active center + 2 side peeks', async ({ page }, testInfo) => {
    const diagnostics = installSmokeDiagnostics(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoDemo(page, '?count=3');

    // Active card (index 0) is fully opaque and marked active.
    await expect.poll(() => cardOpacity(page, 0), { timeout: 5_000 }).toBeGreaterThan(0.95);
    expect(await cardActiveAttr(page, 0)).toBe('true');

    // Index 1 is the right peek — visible at ~0.55 opacity, not active.
    await expect.poll(() => cardOpacity(page, 1), { timeout: 5_000 }).toBeGreaterThan(0.4);
    await expect.poll(() => cardOpacity(page, 1), { timeout: 5_000 }).toBeLessThan(0.7);
    expect(await cardActiveAttr(page, 1)).toBe('false');

    // Index 2 is far — hidden (opacity 0).
    await expect.poll(() => cardOpacity(page, 2), { timeout: 5_000 }).toBeLessThan(0.05);

    // Carousel container is present.
    await expect(page.getByTestId('research-modal-carousel')).toBeVisible();

    // Scrim layer is rendered (4.2 dark stage).
    await expect(page.getByTestId('research-modal-scrim')).toBeAttached();

    await attachSmokeDiagnostics(testInfo, diagnostics);
    assertNoFatalDiagnostics(diagnostics);
  });

  test('clicking a peek neighbor promotes it to active', async ({ page }, testInfo) => {
    const diagnostics = installSmokeDiagnostics(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoDemo(page, '?count=4');

    // Initial: index 0 is active.
    expect(await cardActiveAttr(page, 0)).toBe('true');
    expect(await cardActiveAttr(page, 1)).toBe('false');

    // Click the right-peek card. Use dispatchEvent so RN-Web's Pressable receives
    // a synthetic click event regardless of where in the bounding box Playwright
    // would otherwise target — the perspective transform makes hit-testing flaky.
    await page.getByTestId('research-modal-card-1').dispatchEvent('click');
    await page.waitForTimeout(700);

    // Index 1 becomes active; index 0 becomes a peek (still visible but not active).
    expect(await cardActiveAttr(page, 1)).toBe('true');
    expect(await cardActiveAttr(page, 0)).toBe('false');
    await expect.poll(() => cardOpacity(page, 1), { timeout: 5_000 }).toBeGreaterThan(0.95);
    await expect.poll(() => cardOpacity(page, 0), { timeout: 5_000 }).toBeGreaterThan(0.4);

    // Index 2 should now be the right peek.
    await expect.poll(() => cardOpacity(page, 2), { timeout: 5_000 }).toBeGreaterThan(0.4);

    await attachSmokeDiagnostics(testInfo, diagnostics);
    assertNoFatalDiagnostics(diagnostics);
  });

  test('keyboard ArrowRight / ArrowLeft cycles cards', async ({ page }, testInfo) => {
    const diagnostics = installSmokeDiagnostics(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoDemo(page, '?count=4');

    expect(await cardActiveAttr(page, 0)).toBe('true');

    // ArrowRight → index 1 active.
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(600);
    expect(await cardActiveAttr(page, 1)).toBe('true');

    // ArrowRight → index 2 active.
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(600);
    expect(await cardActiveAttr(page, 2)).toBe('true');

    // ArrowLeft → back to index 1.
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(600);
    expect(await cardActiveAttr(page, 1)).toBe('true');

    await attachSmokeDiagnostics(testInfo, diagnostics);
    assertNoFatalDiagnostics(diagnostics);
  });

  test('single-record state shows only the active card (no side peeks)', async ({ page }, testInfo) => {
    const diagnostics = installSmokeDiagnostics(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoDemo(page, '?count=1');

    // The only card is the active one — fully visible.
    await expect.poll(() => cardOpacity(page, 0), { timeout: 5_000 }).toBeGreaterThan(0.95);
    expect(await cardActiveAttr(page, 0)).toBe('true');

    // No card-1 or card-2 in the DOM.
    await expect(page.getByTestId('research-modal-card-1')).toHaveCount(0);
    await expect(page.getByTestId('research-modal-card-2')).toHaveCount(0);

    // Nav arrows should NOT be present (single record = first AND last).
    await expect(page.getByTestId('research-modal-prev')).toHaveCount(0);
    await expect(page.getByTestId('research-modal-next')).toHaveCount(0);

    await attachSmokeDiagnostics(testInfo, diagnostics);
    assertNoFatalDiagnostics(diagnostics);
  });
});
