import { expect, Page, TestInfo } from '@playwright/test';

import type { SmokeContract } from './smokeContracts';

export interface SmokeDiagnostics {
  consoleErrors: string[];
  pageErrors: string[];
  failedResources: string[];
}

const SEVERE_CONSOLE_PATTERNS = [
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

export function installSmokeDiagnostics(page: Page): SmokeDiagnostics {
  const diagnostics: SmokeDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedResources: [],
  };

  page.on('console', (message) => {
    if (message.type() === 'error') {
      diagnostics.consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push(error.message);
  });

  page.on('requestfailed', (request) => {
    const resourceType = request.resourceType();
    if (resourceType === 'document' || resourceType === 'script' || resourceType === 'stylesheet') {
      diagnostics.failedResources.push(`${resourceType} ${request.url()} ${request.failure()?.errorText || 'request failed'}`);
    }
  });

  return diagnostics;
}

function testIdLocator(page: Page, testId: string) {
  return page.locator(`[data-testid="${testId}"], [id="${testId}"]`);
}

export async function openAndAssertContract(page: Page, contract: SmokeContract): Promise<void> {
  await page.goto(contract.path, { waitUntil: 'domcontentloaded' });
  await expect(testIdLocator(page, contract.testId)).toBeVisible({ timeout: 45_000 });
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(1_000);

  for (const testId of contract.requiredTestIds || []) {
    await expect(testIdLocator(page, testId)).toBeVisible({ timeout: 20_000 });
  }

  for (const text of contract.expectedTexts) {
    await expect(page.getByText(text, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
  }

  for (const text of contract.forbiddenTexts || []) {
    await expect(page.getByText(text, { exact: false })).toHaveCount(0);
  }
}

export async function attachSmokeDiagnostics(
  testInfo: TestInfo,
  diagnostics: SmokeDiagnostics,
): Promise<void> {
  if (diagnostics.consoleErrors.length > 0) {
    await testInfo.attach('console-errors', {
      body: Buffer.from(diagnostics.consoleErrors.join('\n\n'), 'utf8'),
      contentType: 'text/plain',
    });
  }

  if (diagnostics.pageErrors.length > 0) {
    await testInfo.attach('page-errors', {
      body: Buffer.from(diagnostics.pageErrors.join('\n\n'), 'utf8'),
      contentType: 'text/plain',
    });
  }

  if (diagnostics.failedResources.length > 0) {
    await testInfo.attach('failed-resources', {
      body: Buffer.from(diagnostics.failedResources.join('\n\n'), 'utf8'),
      contentType: 'text/plain',
    });
  }
}

export function assertNoFatalDiagnostics(diagnostics: SmokeDiagnostics): void {
  const severeConsoleErrors = diagnostics.consoleErrors.filter((message) =>
    SEVERE_CONSOLE_PATTERNS.some((pattern) => pattern.test(message)),
  );

  expect(
    {
      pageErrors: diagnostics.pageErrors,
      failedResources: diagnostics.failedResources,
      severeConsoleErrors,
    },
    'Smoke run surfaced fatal runtime diagnostics',
  ).toEqual({
    pageErrors: [],
    failedResources: [],
    severeConsoleErrors: [],
  });
}
