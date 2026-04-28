import { expect, test, type Page } from '@playwright/test';

import {
  assertNoFatalDiagnostics,
  attachSmokeDiagnostics,
  installSmokeDiagnostics,
} from './smokeHelpers';

async function expectFeatureCardsDoNotOverlap(page: Page) {
  await page.getByTestId('landing-features-grid').scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);

  const boxes = await page.getByTestId('landing-feature-card').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      };
    }),
  );

  expect(boxes).toHaveLength(6);

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const overlaps =
        a.left < b.right - 1 &&
        b.left < a.right - 1 &&
        a.top < b.bottom - 1 &&
        b.top < a.bottom - 1;

      expect(overlaps, `feature cards ${i} and ${j} should not overlap`).toBe(false);
    }
  }
}

test.describe('Landing layout', () => {
  test('centers the office preview and keeps feature cards separated', async ({ page }, testInfo) => {
    const diagnostics = installSmokeDiagnostics(page);

    await page.setViewportSize({ width: 1920, height: 1032 });
    await page.goto('/landing', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('smoke-landing-root')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('landing-cockpit-frame')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1_200);

    const frame = await page.getByTestId('landing-cockpit-frame').boundingBox();
    const avaDesk = await page.getByTestId('ava-desk-panel').boundingBox();

    expect(frame, 'landing cockpit frame should have a layout box').not.toBeNull();
    expect(avaDesk, 'Ava Desk preview should have a layout box').not.toBeNull();

    const viewportCenter = 1920 / 2;
    const frameCenter = frame!.x + frame!.width / 2;
    const avaDeskCenter = avaDesk!.x + avaDesk!.width / 2;

    expect(Math.abs(frameCenter - viewportCenter)).toBeLessThanOrEqual(16);
    expect(Math.abs(avaDeskCenter - frameCenter)).toBeLessThanOrEqual(frame!.width * 0.12);

    await expectFeatureCardsDoNotOverlap(page);

    await page.setViewportSize({ width: 900, height: 900 });
    await page.waitForTimeout(400);
    await expectFeatureCardsDoNotOverlap(page);

    await attachSmokeDiagnostics(testInfo, diagnostics);
    assertNoFatalDiagnostics(diagnostics);
  });
});
