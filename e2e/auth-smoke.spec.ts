import { test } from '@playwright/test';

import { AUTH_SMOKE_CONTRACTS } from './smokeContracts';
import {
  assertNoFatalDiagnostics,
  attachSmokeDiagnostics,
  installSmokeDiagnostics,
  openAndAssertContract,
} from './smokeHelpers';

test.describe('Aspire desktop authenticated smoke', () => {
  for (const contract of AUTH_SMOKE_CONTRACTS) {
    test(`${contract.id} | ${contract.name}`, async ({ page }, testInfo) => {
      const diagnostics = installSmokeDiagnostics(page);
      await openAndAssertContract(page, contract);
      await attachSmokeDiagnostics(testInfo, diagnostics);
      assertNoFatalDiagnostics(diagnostics);
    });
  }
});
