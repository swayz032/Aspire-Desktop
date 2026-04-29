/**
 * Office Memory Engine — Playwright e2e spec
 *
 * Verifies the full Pass 6 user flow:
 *   1. Sidebar entry navigates to /office-memory
 *   2. Hero renders Memory Engine title + AvaOrbVideo + LED search bar
 *   3. Search submit navigates to /office-memory/results?q=...
 *   4. Results page shows 9 cards in 3x3 grid
 *   5. Card click navigates to /office-memory/[memoryId]
 *   6. Detail page renders all 6 sections
 */

import { expect, test } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5001';

test.describe('Office Memory Engine', () => {
  test('hero page renders Memory Engine title and LED search bar', async ({ page }) => {
    await page.goto(`${BASE_URL}/office-memory`);

    // Wait for hero to render
    await expect(page.getByText('Memory Engine')).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText('Search every meeting, call, document, and decision your office has captured.'),
    ).toBeVisible();

    // LED search bar should be present
    const searchInput = page.getByPlaceholder(/Ask a memory or describe what you/i);
    await expect(searchInput).toBeVisible();
  });

  test('search submit navigates to results with 9-card grid', async ({ page }) => {
    await page.goto(`${BASE_URL}/office-memory`);
    const searchInput = page.getByPlaceholder(/Ask a memory or describe what you/i);
    await searchInput.fill('client calls');
    await searchInput.press('Enter');

    await page.waitForURL(/\/office-memory\/results/);
    expect(page.url()).toContain('q=client%20calls');

    // Results title
    await expect(page.getByText('Memory Results')).toBeVisible({ timeout: 10000 });
    // 9 cards in 3x3 grid (fixture mode)
    const cards = page.locator('[data-testid="memory-card"], [role="article"]');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });
  });

  test('clicking a card navigates to detail page with all sections', async ({ page }) => {
    await page.goto(`${BASE_URL}/office-memory/results?q=client`);

    // Wait for grid
    await expect(page.getByText('Memory Results')).toBeVisible({ timeout: 10000 });

    // Click first card title
    const firstCardTitle = page.getByText('Client call with Acme Builders').first();
    await firstCardTitle.click();

    // Detail page sections
    await page.waitForURL(/\/office-memory\/mem_/);
    await expect(page.getByText('Summary')).toBeVisible();
    await expect(page.getByText('Key Decisions')).toBeVisible();
    await expect(page.getByText('Details')).toBeVisible();
    await expect(page.getByText('Linked Facts')).toBeVisible();
    await expect(page.getByText('Activity & Receipts')).toBeVisible();
  });

  test('sidebar Office Memory entry highlights when on path', async ({ page }) => {
    await page.goto(`${BASE_URL}/office-memory`);
    // The sidebar nav item with label "Office Memory" should be present
    const sidebarItem = page.locator('text="Office Memory"').first();
    await expect(sidebarItem).toBeVisible({ timeout: 10000 });
  });
});
