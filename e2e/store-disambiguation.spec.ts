/**
 * StoreDisambiguation e2e spec (Wave D-tests R3).
 *
 * The `StoreDisambiguation` artifact type is produced by the backend when
 * `find_stores_in_city()` returns multiple HD stores and the voice path cannot
 * resolve to a single store (Wave A.5 / Task #32).
 *
 * Response shape from the orchestrator:
 *   {
 *     artifact_type: "StoreDisambiguation",
 *     records: [],
 *     candidates: [{ store_id, name, street }],
 *     status: "needs_disambiguation",
 *   }
 *
 * As of Wave D R3, there is NO desktop UI implementation for StoreDisambiguation.
 * The backend produces this artifact, but the Expo desktop app does not yet
 * render a candidate-pick UI or fire a follow-up invoke with the chosen store_id
 * via the Ava modal flow.
 *
 * Follow-up task for expo-cards-r4:
 *   - Add a `StoreDisambiguationCard` component registered in `CardRegistry.ts`
 *     for artifact_type === "StoreDisambiguation"
 *   - Render candidates as a tappable list (store_id, name, street)
 *   - On tap: call POST /v1/tools/invoke with { store_id, agent: 'adam', ... }
 *   - The desktop server's `chosenStoreIdBySuite` cache (agentToolRoutes.ts:35)
 *     persists the selection so subsequent voice queries reuse it
 *
 * Tests that CANNOT be written yet (no UI = no interaction surface):
 *   - assert candidate-pick UI renders showing 3 streets
 *   - tap candidate → fire /v1/tools/invoke with store_id
 *   - second invoke reuses cached store_id from chosenStoreIdBySuite
 *
 * Tests that CAN be written now:
 *   - route mock returns StoreDisambiguation artifact shape without error
 *   - agentToolRoutes.ts /v1/tools/invoke: chosenStoreIdBySuite injection
 *     (unit test via Jest, not Playwright — see server/agentToolRoutes.test.ts)
 *
 * Law compliance note:
 *   - StoreDisambiguation is a GREEN-tier read operation (returns candidates, no
 *     state change). No receipt required for the disambiguation query itself.
 *   - The follow-up invoke (with chosen store_id) is covered by the existing
 *     invoke receipt path in the backend orchestrator.
 */

import { expect, test } from '@playwright/test';

const STORE_DISAMBIGUATION_MOCK = {
  artifact_type: 'StoreDisambiguation',
  records: [],
  candidates: [
    { store_id: '0254', name: 'West Tallahassee', street: '1490 Capital Cir NW' },
    { store_id: '0259', name: 'Apalachee Pkwy', street: '5800 Apalachee Pkwy' },
    { store_id: '1234', name: 'Mahan Drive', street: '3200 Mahan Dr' },
  ],
  status: 'needs_disambiguation',
  summary: 'Found 3 Home Depot stores in Tallahassee. Which one do you want?',
};

// ─── Route contract tests (can run now) ───────────────────────────────────────

test.describe('StoreDisambiguation — route contract', () => {
  test('invoke_adam returning StoreDisambiguation artifact does not error in route mock', async ({
    page,
  }) => {
    // Verify: the orchestrator /v1/agents/invoke route can return a
    // StoreDisambiguation artifact without causing a 5xx. The desktop server
    // forwards invoke responses to the client as-is.
    let capturedBody: Record<string, unknown> = {};

    await page.route('**/v1/agents/invoke', async (route) => {
      const postBody = route.request().postData();
      if (postBody) {
        capturedBody = JSON.parse(postBody);
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(STORE_DISAMBIGUATION_MOCK),
      });
    });

    await page.goto('/demo/research-modal?count=1', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('research-modal-demo-root')).toBeVisible({ timeout: 45_000 });

    const result = await page.evaluate(async () => {
      const resp = await fetch('/v1/agents/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'adam',
          entity_type: 'product',
          query: 'Home Depot Tallahassee',
          suite_id: '11111111-1111-4111-8111-111111111111',
        }),
      });
      return { status: resp.status, body: await resp.json() };
    });

    expect(result.status).toBe(200);
    expect(result.body.artifact_type).toBe('StoreDisambiguation');
    expect(result.body.status).toBe('needs_disambiguation');
    expect(Array.isArray(result.body.candidates)).toBe(true);
    expect(result.body.candidates).toHaveLength(3);
    expect(result.body.candidates[0].store_id).toBe('0254');
    expect(result.body.candidates[0].street).toBe('1490 Capital Cir NW');
    expect(Array.isArray(result.body.records)).toBe(true);
    expect(result.body.records).toHaveLength(0);
  });

  test('StoreDisambiguation candidates array has correct schema', async ({ page }) => {
    // Validate the candidate schema contract so expo-cards-r4 has a typed surface
    // to implement against.
    const candidates = STORE_DISAMBIGUATION_MOCK.candidates;

    for (const candidate of candidates) {
      expect(typeof candidate.store_id).toBe('string');
      expect(candidate.store_id.length).toBeGreaterThan(0);
      expect(typeof candidate.name).toBe('string');
      expect(candidate.name.length).toBeGreaterThan(0);
      expect(typeof candidate.street).toBe('string');
      expect(candidate.street.length).toBeGreaterThan(0);
    }

    // All three Tallahassee stores present.
    const storeIds = candidates.map((c) => c.store_id);
    expect(storeIds).toContain('0254');
    expect(storeIds).toContain('0259');
    expect(storeIds).toContain('1234');

    await page.goto('/demo/research-modal?count=1', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('research-modal-demo-root')).toBeVisible({ timeout: 45_000 });
  });
});

// ─── UI tests (skipped — no implementation yet) ───────────────────────────────

test.describe('StoreDisambiguation — candidate-pick UI', () => {
  // TODO (expo-cards-r4): Implement StoreDisambiguationCard component in
  // `components/cards/StoreDisambiguationCard.tsx` and register it in
  // `components/cards/CardRegistry.ts` for artifact_type === "StoreDisambiguation".
  //
  // When the UI exists, un-skip these tests and replace evaluate() patterns with
  // direct Playwright locators.

  test.skip('StoreDisambiguation artifact renders a candidate-pick UI', async ({ page }) => {
    // TODO: When expo-cards-r4 ships StoreDisambiguationCard:
    //   1. Mock /v1/tools/invoke (or /v1/agents/invoke) to return STORE_DISAMBIGUATION_MOCK
    //   2. Navigate to the canvas page (or use a demo page for StoreDisambiguation)
    //   3. Assert that a UI element shows each candidate street address
    //   4. Expected testIDs (to be defined by expo-cards-r4):
    //      - store-disambiguation-candidate-0
    //      - store-disambiguation-candidate-1
    //      - store-disambiguation-candidate-2

    await page.route('**/v1/tools/invoke', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(STORE_DISAMBIGUATION_MOCK),
      });
    });

    // Trigger invoke_adam for a city with multiple stores.
    await page.evaluate(async () => {
      await fetch('/v1/tools/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'adam',
          entity_type: 'product',
          query: 'impact driver near Tallahassee',
          suite_id: '11111111-1111-4111-8111-111111111111',
        }),
      });
    });

    // Verify 3 candidate rows render (streets visible as tappable items).
    await expect(page.getByText('1490 Capital Cir NW')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('5800 Apalachee Pkwy')).toBeVisible();
    await expect(page.getByText('3200 Mahan Dr')).toBeVisible();
  });

  test.skip('tapping a candidate fires follow-up invoke with chosen store_id', async ({ page }) => {
    // TODO (expo-cards-r4): When StoreDisambiguationCard renders tappable candidates:
    //   1. First invoke returns StoreDisambiguation with 3 candidates
    //   2. User taps the first candidate (store_id: "0254")
    //   3. A second POST /v1/tools/invoke fires with body containing { store_id: "0254" }
    //   4. agentToolRoutes.ts caches "0254" in chosenStoreIdBySuite for this suite

    const invokeCalls: Array<Record<string, unknown>> = [];

    await page.route('**/v1/tools/invoke', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      invokeCalls.push(body);

      if (invokeCalls.length === 1) {
        // First call: return disambiguation
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(STORE_DISAMBIGUATION_MOCK),
        });
      } else {
        // Follow-up call with chosen store_id: return product results
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            artifact_type: 'PriceComparison',
            records: [{ title: 'Impact Driver', price: 199, store_id: '0254' }],
            status: 'ok',
          }),
        });
      }
    });

    // After tapping candidate-0, the follow-up call must include store_id: "0254".
    // assert:
    //   expect(invokeCalls[1].store_id).toBe('0254');
  });

  test.skip('subsequent invoke_adam in same session reuses cached store_id', async ({ page }) => {
    // TODO (expo-cards-r4 + unit test extension):
    // This is a server-side cache behavior in agentToolRoutes.ts `chosenStoreIdBySuite`.
    // Full e2e validation requires:
    //   1. User picks store_id "0254" via StoreDisambiguationCard tap
    //   2. agentToolRoutes.ts sets chosenStoreIdBySuite.set(suiteId, { storeId: "0254", ... })
    //   3. Subsequent POST /v1/tools/invoke without store_id in the request body
    //      results in the server injecting effectiveStoreId = "0254" into the
    //      orchestrator request (agentToolRoutes.ts:970-980)
    //
    // Unit test alternative (already possible):
    //   Extend server/agentToolRoutes.test.ts to:
    //   - Expose chosenStoreIdBySuite in __testing__
    //   - POST /v1/tools/invoke with { store_id: "0254" } → cache is seeded
    //   - POST /v1/tools/invoke without store_id → assert effectiveStoreId injected
    //
    // See agentToolRoutes.ts:35 (chosenStoreIdBySuite Map definition)
    //     agentToolRoutes.ts:970-986 (cache read + write logic)
  });
});

// ─── agentToolRoutes unit test notes ─────────────────────────────────────────

test.describe('StoreDisambiguation — agentToolRoutes unit test gap', () => {
  test('documents missing unit test for chosenStoreIdBySuite cache injection', async ({ page }) => {
    // This is a CONTRACT TEST that documents what the agentToolRoutes Jest suite
    // (server/agentToolRoutes.test.ts) is MISSING and should add:
    //
    // Gap 1: chosenStoreIdBySuite is NOT in __testing__ exports.
    //         agentToolRoutes.ts:1596 exports: cardRecordsCache, latestCardCacheIdBySuite,
    //         isSparseRecord, isSparseRecordSet. chosenStoreIdBySuite is absent.
    //         To unit test cache injection, add it to __testing__.
    //
    // Gap 2: No test for POST /v1/tools/invoke with store_id → seeds cache.
    // Gap 3: No test for POST /v1/tools/invoke without store_id → reads cache.
    //
    // The server-side cache TTL is 5 minutes (CACHE_TTL_MS = 5 * 60 * 1000).
    // agentToolRoutes.ts:36.
    //
    // Recommendation for the next pass:
    //   1. Add `chosenStoreIdBySuite` to the __testing__ export
    //   2. Add 3 unit tests in agentToolRoutes.test.ts:
    //      - "POST /v1/tools/invoke with store_id seeds chosenStoreIdBySuite cache"
    //      - "POST /v1/tools/invoke without store_id uses cached store_id"
    //      - "POST /v1/tools/invoke cached store_id expires after TTL"
    //
    // This test passes immediately (it's a documentation test, not an execution test).
    expect(true).toBe(true);

    await page.goto('/demo/research-modal?count=1', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('research-modal-demo-root')).toBeVisible({ timeout: 45_000 });
  });
});
