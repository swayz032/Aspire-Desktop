/**
 * Front Desk Setup (Pass 10 redesign) — Playwright e2e spec
 *
 * Verifies the redesigned page renders all 5 sections + right rail.
 */

import { expect, test } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5001';

test.describe('Front Desk Setup — Pass 10 redesign', () => {
  test('hero renders FRONT DESK pill, title, and Test/Save buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/session/calls/setup`);

    await expect(page.getByText('FRONT DESK')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Front Desk Setup')).toBeVisible();
    await expect(page.getByRole('button', { name: /Test Incoming Call/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Save Changes/i })).toBeVisible();
  });

  test('all 5 numbered sections render', async ({ page }) => {
    await page.goto(`${BASE_URL}/session/calls/setup`);
    await expect(page.getByText('Public Number')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('How You Catch Calls')).toBeVisible();
    await expect(page.getByText('Business Hours')).toBeVisible();
    await expect(page.getByText('Routing Contacts')).toBeVisible();
    await expect(page.getByText("When We're Busy")).toBeVisible();
  });

  test('right rail shows 3 cards (Sarah Status, Setup Summary, Verification)', async ({ page }) => {
    await page.goto(`${BASE_URL}/session/calls/setup`);
    await expect(page.getByText('Sarah Status')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Current Setup Summary')).toBeVisible();
    await expect(page.getByText('Verification')).toBeVisible();
  });

  test('+ Add contact opens modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/session/calls/setup`);
    await expect(page.getByText('Routing Contacts')).toBeVisible({ timeout: 10000 });
    const addBtn = page.getByRole('button', { name: /\+ Add contact/i });
    await addBtn.click();
    // Modal should now be visible — look for an input field characteristic of the editor
    await expect(
      page.locator('input[placeholder*="Name" i], input[placeholder*="phone" i]').first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
