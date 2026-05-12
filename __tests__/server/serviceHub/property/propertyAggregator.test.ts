/**
 * Integration tests for propertyAggregator.
 *
 * All upstream clients are mocked (jest.mock at the top of the file)
 * plus the db + receipt service. These tests verify the orchestration
 * contract — Stage 1 gate, Stage 2 fan-out, Stage 3 heuristics, and the
 * cache + receipt side effects.
 *
 * Pass 3.1 (2026-05-10): Apify Zillow + Static Maps clients deleted.
 * Property facts + photos now come from Adam (Python orchestrator)
 * via the adamResearchClient. Aerial map is rendered client-side via
 * Maps JS API; no server-side aerial fetch.
 */

// Hoisted mocks ---------------------------------------------------------------

jest.mock('../../../../server/db', () => ({
  __esModule: true,
  db: { execute: jest.fn() },
}));

jest.mock('drizzle-orm', () => ({
  __esModule: true,
  sql: Object.assign(
    (..._args: unknown[]) => ({ __sql: true }),
    {
      raw: (s: string) => s,
    },
  ),
}));

jest.mock('../../../../server/receiptService', () => ({
  __esModule: true,
  createReceipt: jest.fn(async () => 'receipt_id_test'),
}));

jest.mock('../../../../server/serviceHub/property/adamResearchClient', () => ({
  __esModule: true,
  fetchAdamPropertyResearch: jest.fn(),
}));

jest.mock('../../../../server/serviceHub/property/googleAddressValidationClient', () => ({
  __esModule: true,
  validateAddress: jest.fn(),
}));

jest.mock('../../../../server/serviceHub/property/googleGeocodingClient', () => ({
  __esModule: true,
  geocodeAddress: jest.fn(),
}));

jest.mock('../../../../server/serviceHub/property/googleSolarClient', () => ({
  __esModule: true,
  fetchSolarInsights: jest.fn(),
}));

// Imports (after mocks) -------------------------------------------------------

import { aggregatePropertyData } from '../../../../server/serviceHub/property/propertyAggregator';
import { db } from '../../../../server/db';
import { createReceipt } from '../../../../server/receiptService';
import { fetchAdamPropertyResearch } from '../../../../server/serviceHub/property/adamResearchClient';
import { validateAddress } from '../../../../server/serviceHub/property/googleAddressValidationClient';
import { geocodeAddress } from '../../../../server/serviceHub/property/googleGeocodingClient';
import { fetchSolarInsights } from '../../../../server/serviceHub/property/googleSolarClient';

// Type cast helpers
const dbExec = (db.execute as unknown) as jest.Mock;
const mkValid = validateAddress as unknown as jest.Mock;
const mkGeo = geocodeAddress as unknown as jest.Mock;
const mkSolar = fetchSolarInsights as unknown as jest.Mock;
const mkAdam = fetchAdamPropertyResearch as unknown as jest.Mock;
const mkReceipt = createReceipt as unknown as jest.Mock;

const SUITE_A = '11111111-1111-1111-1111-111111111111';
const ADDR = '1234 Industrial Way, Austin, TX 78758';

const FETCHED_AT = '2026-05-10T12:00:00.000Z';

beforeEach(() => {
  jest.clearAllMocks();
  // Default: empty cache, write succeeds.
  dbExec.mockResolvedValue({ rows: [] });
});

/* ---------------------------------------------------------------------- */
/* Stage 1 gate                                                            */
/* ---------------------------------------------------------------------- */

test('address invalid → 422 path, NO downstream calls fire', async () => {
  mkValid.mockResolvedValue({
    status: 'invalid',
    reason: 'undeliverable',
    fetchedAt: FETCHED_AT,
  });

  const result = await aggregatePropertyData('123 Fake St NoCity', { suiteId: SUITE_A });

  expect(result.kind).toBe('invalid');
  expect(mkGeo).not.toHaveBeenCalled();
  expect(mkSolar).not.toHaveBeenCalled();
  expect(mkAdam).not.toHaveBeenCalled();
  // Receipt still written.
  expect(mkReceipt).toHaveBeenCalledTimes(1);
});

test('address needs correction → 200 path with suggestedAddress, NO downstream calls', async () => {
  mkValid.mockResolvedValue({
    status: 'needs_correction',
    suggestedAddress: '1234 Industrial Way, Austin, TX 78758',
    components: { street: '1234 Industrial Way', city: 'Austin', state: 'TX', zip: '78758' },
    fetchedAt: FETCHED_AT,
  });

  const result = await aggregatePropertyData('1234 industrial way austin', { suiteId: SUITE_A });

  expect(result.kind).toBe('needs_correction');
  if (result.kind === 'needs_correction') {
    expect(result.payload).toEqual({
      suggestedAddress: '1234 Industrial Way, Austin, TX 78758',
      components: expect.any(Object),
      propertyData: null,
    });
  }
  expect(mkGeo).not.toHaveBeenCalled();
  expect(mkSolar).not.toHaveBeenCalled();
  expect(mkAdam).not.toHaveBeenCalled();
  expect(mkReceipt).toHaveBeenCalledTimes(1);
});

test('empty address → invalid without calling any upstream', async () => {
  const result = await aggregatePropertyData('   ', { suiteId: SUITE_A });
  expect(result.kind).toBe('invalid');
  expect(mkValid).not.toHaveBeenCalled();
});

test('missing suiteId → invalid', async () => {
  const result = await aggregatePropertyData(ADDR, { suiteId: '' });
  expect(result.kind).toBe('invalid');
  expect(mkValid).not.toHaveBeenCalled();
});

/* ---------------------------------------------------------------------- */
/* Happy path                                                              */
/* ---------------------------------------------------------------------- */

test('happy path → all sources ok, full PropertyData', async () => {
  mkValid.mockResolvedValue({
    status: 'valid',
    formatted: ADDR,
    components: { street: '1234 Industrial Way', city: 'Austin', state: 'TX', zip: '78758', country: 'US' },
    coords: { lat: 30.4, lng: -97.7 },
    fetchedAt: FETCHED_AT,
  });
  mkSolar.mockResolvedValue({
    status: 'ok',
    roofType: 'TPO_MEMBRANE',
    roofAreaSqMeters: 1100,
    panelCapacityWatts: 400,
    maxPanelCount: 280,
  });
  mkAdam.mockResolvedValue({
    status: 'ok',
    fetchedAt: FETCHED_AT,
    facts: {
      sqft: 12000,
      yearBuilt: 1998,
      zoning: 'I-1',
      propertyType: 'WAREHOUSE',
      lotSqft: 43560,
      stories: 1,
    },
    photos: {
      interior: { count: 1, photos: [{ url: 'https://photos.zillow/b.jpg', caption: 'Office interior' }] },
      exterior: { count: 1, photos: [{ url: 'https://photos.zillow/a.jpg', caption: 'Front exterior' }] },
      roof: { count: 1, photos: [{ url: 'https://photos.zillow/c.jpg', caption: 'Roof view' }] },
      uncategorized: { count: 0, photos: [] },
    },
    receiptsFromAdam: [{ correlationId: 'adam_corr_abc' }],
  });

  const result = await aggregatePropertyData(ADDR, { suiteId: SUITE_A });

  expect(result.kind).toBe('ok');
  if (result.kind !== 'ok') return;
  const data = result.data;
  expect(data.address.formatted).toBe(ADDR);
  expect(data.coords).toEqual({ lat: 30.4, lng: -97.7 });
  expect(data.facts.sqft).toBe(12000);
  expect(data.facts.propertyType).toBe('WAREHOUSE');
  // No aerialMapUrl on hero anymore — client renders aerial via Maps JS.
  expect((data.hero as Record<string, unknown>).aerialMapUrl).toBeUndefined();
  expect(data.hero.streetViewProxyUrl).toContain('/api/places/streetview?address=');
  expect(data.photos.exterior.count).toBe(1);
  expect(data.photos.interior.count).toBe(1);
  expect(data.photos.roof.count).toBe(1);
  expect(data.photos.streetView.count).toBe(1);
  expect(data.photos.exterior.photos[0].source).toBe('adam');
  expect(data.signals.materials.length).toBeGreaterThan(0);
  expect(data.signals.roofType).toBe('TPO_MEMBRANE');
  expect(data.costBand.low).toBeGreaterThan(0);
  expect(data.costBand.high).toBeGreaterThan(data.costBand.low);
  expect(data.evidenceGaps).toEqual([]);

  // No geocoding call when validation already supplied coords.
  expect(mkGeo).not.toHaveBeenCalled();

  // Source statuses
  const sources = Object.fromEntries(data.sources.map((s) => [s.name, s.status]));
  expect(sources.addressValidation).toBe('ok');
  expect(sources.adam).toBe('ok');
  expect(sources.solar).toBe('ok');
  expect(sources.streetView).toBe('ok');
  // Static Maps source is gone.
  expect(sources.staticMaps).toBeUndefined();
  // apifyZillow source is gone.
  expect(sources.apifyZillow).toBeUndefined();
});

test('Adam call receives suiteId, officeId, and a correlationId', async () => {
  mkValid.mockResolvedValue({
    status: 'valid',
    formatted: ADDR,
    coords: { lat: 30.4, lng: -97.7 },
    fetchedAt: FETCHED_AT,
  });
  mkSolar.mockResolvedValue({ status: 'missing' });
  mkAdam.mockResolvedValue({
    status: 'ok',
    fetchedAt: FETCHED_AT,
    facts: { propertyType: 'SINGLE_FAMILY' },
    photos: { interior: { count: 0, photos: [] }, exterior: { count: 0, photos: [] }, roof: { count: 0, photos: [] }, uncategorized: { count: 0, photos: [] } },
    receiptsFromAdam: [],
  });

  await aggregatePropertyData(ADDR, { suiteId: SUITE_A, officeId: 'office_123' });

  expect(mkAdam).toHaveBeenCalledTimes(1);
  const call = mkAdam.mock.calls[0][0];
  expect(call.address).toBe(ADDR);
  expect(call.suiteId).toBe(SUITE_A);
  expect(call.officeId).toBe('office_123');
  expect(typeof call.correlationId).toBe('string');
  expect(call.correlationId.length).toBeGreaterThan(0);
});

/* ---------------------------------------------------------------------- */
/* Per-source failure handling                                             */
/* ---------------------------------------------------------------------- */

test('Adam failure → status=partial path, empty facts + empty photos, sources[adam]=api_failure', async () => {
  mkValid.mockResolvedValue({
    status: 'valid',
    formatted: ADDR,
    coords: { lat: 30.4, lng: -97.7 },
    fetchedAt: FETCHED_AT,
  });
  mkSolar.mockResolvedValue({ status: 'ok', roofType: 'TPO' });
  mkAdam.mockRejectedValue(new Error('adam unreachable'));

  const result = await aggregatePropertyData(ADDR, { suiteId: SUITE_A });
  expect(result.kind).toBe('ok');
  if (result.kind !== 'ok') return;

  // Facts empty → all gaps reported.
  expect(result.data.evidenceGaps).toEqual(
    expect.arrayContaining(['sqft', 'yearBuilt', 'zoning', 'propertyType', 'lotSqft']),
  );
  // Photos lanes are empty (still has streetView fallback lane).
  expect(result.data.photos.interior.count).toBe(0);
  expect(result.data.photos.exterior.count).toBe(0);
  expect(result.data.photos.roof.count).toBe(0);
  const adam = result.data.sources.find((s) => s.name === 'adam');
  expect(adam?.status).toBe('api_failure');
});

test('Adam returns missing → sources[adam]=missing, no facts, no photos', async () => {
  mkValid.mockResolvedValue({
    status: 'valid',
    formatted: ADDR,
    coords: { lat: 30.4, lng: -97.7 },
    fetchedAt: FETCHED_AT,
  });
  mkSolar.mockResolvedValue({ status: 'missing' });
  mkAdam.mockResolvedValue({
    status: 'missing',
    fetchedAt: FETCHED_AT,
    facts: undefined,
    photos: undefined,
    receiptsFromAdam: [],
  });

  const result = await aggregatePropertyData(ADDR, { suiteId: SUITE_A });
  expect(result.kind).toBe('ok');
  if (result.kind !== 'ok') return;
  const adam = result.data.sources.find((s) => s.name === 'adam');
  expect(adam?.status).toBe('missing');
});

test('Solar 404 → roofType undefined, no error, sources[solar]=missing', async () => {
  mkValid.mockResolvedValue({
    status: 'valid',
    formatted: ADDR,
    coords: { lat: 30.4, lng: -97.7 },
    fetchedAt: FETCHED_AT,
  });
  mkSolar.mockResolvedValue({ status: 'missing' });
  mkAdam.mockResolvedValue({
    status: 'ok',
    fetchedAt: FETCHED_AT,
    facts: { sqft: 1800, propertyType: 'SINGLE_FAMILY' },
    photos: { interior: { count: 0, photos: [] }, exterior: { count: 0, photos: [] }, roof: { count: 0, photos: [] }, uncategorized: { count: 0, photos: [] } },
    receiptsFromAdam: [],
  });

  const result = await aggregatePropertyData(ADDR, { suiteId: SUITE_A });
  expect(result.kind).toBe('ok');
  if (result.kind !== 'ok') return;
  expect(result.data.signals.roofType).toBeUndefined();
  const solar = result.data.sources.find((s) => s.name === 'solar');
  expect(solar?.status).toBe('missing');
});

test('Validation api_failure + Geocoding fallback resolves coords', async () => {
  mkValid.mockResolvedValue({ status: 'api_failure', fetchedAt: FETCHED_AT });
  mkGeo.mockResolvedValue({ status: 'ok', coords: { lat: 1, lng: 2 }, formatted: ADDR });
  mkSolar.mockResolvedValue({ status: 'missing' });
  mkAdam.mockResolvedValue({
    status: 'ok',
    fetchedAt: FETCHED_AT,
    facts: {},
    photos: { interior: { count: 0, photos: [] }, exterior: { count: 0, photos: [] }, roof: { count: 0, photos: [] }, uncategorized: { count: 0, photos: [] } },
    receiptsFromAdam: [],
  });

  const result = await aggregatePropertyData(ADDR, { suiteId: SUITE_A });
  expect(result.kind).toBe('ok');
  if (result.kind !== 'ok') return;
  expect(result.data.coords).toEqual({ lat: 1, lng: 2 });
  expect(mkGeo).toHaveBeenCalledTimes(1);
  const geo = result.data.sources.find((s) => s.name === 'geocoding');
  expect(geo?.status).toBe('ok');
});

test('uncategorized photos fold into exterior lane', async () => {
  mkValid.mockResolvedValue({
    status: 'valid',
    formatted: ADDR,
    coords: { lat: 30.4, lng: -97.7 },
    fetchedAt: FETCHED_AT,
  });
  mkSolar.mockResolvedValue({ status: 'missing' });
  mkAdam.mockResolvedValue({
    status: 'ok',
    fetchedAt: FETCHED_AT,
    facts: {},
    photos: {
      interior: { count: 0, photos: [] },
      exterior: { count: 1, photos: [{ url: 'https://e.jpg' }] },
      roof: { count: 0, photos: [] },
      uncategorized: { count: 2, photos: [{ url: 'https://u1.jpg' }, { url: 'https://u2.jpg' }] },
    },
    receiptsFromAdam: [],
  });

  const result = await aggregatePropertyData(ADDR, { suiteId: SUITE_A });
  expect(result.kind).toBe('ok');
  if (result.kind !== 'ok') return;
  expect(result.data.photos.exterior.count).toBe(3);
});

/* ---------------------------------------------------------------------- */
/* Cache + receipt                                                          */
/* ---------------------------------------------------------------------- */

test('cache hit → returns cached row, no upstream calls', async () => {
  const cached = {
    address: { formatted: ADDR },
    coords: { lat: 1, lng: 2 },
    hero: {},
    facts: {},
    photos: { interior: { count: 0, photos: [] }, exterior: { count: 0, photos: [] }, roof: { count: 0, photos: [] }, streetView: { count: 0, photos: [] } },
    signals: { materials: [] },
    costBand: { low: 0, high: 0, currency: 'USD' },
    evidenceGaps: [],
    fetchedAt: FETCHED_AT,
    sources: [],
  };
  dbExec.mockResolvedValueOnce({ rows: [{ data_jsonb: cached, fetched_at: FETCHED_AT }] });

  const result = await aggregatePropertyData(ADDR, { suiteId: SUITE_A });
  expect(result.kind).toBe('ok');
  if (result.kind !== 'ok') return;
  expect(result.cacheHit).toBe(true);
  expect(mkValid).not.toHaveBeenCalled();
  expect(mkAdam).not.toHaveBeenCalled();
});

test('forceRefresh skips cache lookup', async () => {
  const cached = { sources: [] } as unknown;
  dbExec.mockResolvedValue({ rows: [{ data_jsonb: cached, fetched_at: FETCHED_AT }] });
  mkValid.mockResolvedValue({ status: 'valid', formatted: ADDR, coords: { lat: 1, lng: 2 }, fetchedAt: FETCHED_AT });
  mkSolar.mockResolvedValue({ status: 'missing' });
  mkAdam.mockResolvedValue({
    status: 'ok',
    fetchedAt: FETCHED_AT,
    facts: {},
    photos: { interior: { count: 0, photos: [] }, exterior: { count: 0, photos: [] }, roof: { count: 0, photos: [] }, uncategorized: { count: 0, photos: [] } },
    receiptsFromAdam: [],
  });

  await aggregatePropertyData(ADDR, { suiteId: SUITE_A, forceRefresh: true });
  expect(mkValid).toHaveBeenCalledTimes(1);
});

test('receipt is written for every fetch (success path) and chains Adam correlation_id', async () => {
  mkValid.mockResolvedValue({ status: 'valid', formatted: ADDR, coords: { lat: 1, lng: 2 }, fetchedAt: FETCHED_AT });
  mkSolar.mockResolvedValue({ status: 'missing' });
  mkAdam.mockResolvedValue({
    status: 'ok',
    fetchedAt: FETCHED_AT,
    facts: {},
    photos: { interior: { count: 0, photos: [] }, exterior: { count: 0, photos: [] }, roof: { count: 0, photos: [] }, uncategorized: { count: 0, photos: [] } },
    receiptsFromAdam: [{ correlationId: 'adam_corr_xyz' }],
  });

  await aggregatePropertyData(ADDR, { suiteId: SUITE_A });
  expect(mkReceipt).toHaveBeenCalledTimes(1);
  const call = mkReceipt.mock.calls[0][0];
  expect(call.suiteId).toBe(SUITE_A);
  expect(call.actionType).toBe('compute_snapshot');
  expect(call.inputs.action).toBe('service_hub.property_data.fetched');
  // Trace continuity: Adam's correlation_id chained into evidence (Law #2).
  expect(call.outputs.evidence).toEqual(
    expect.arrayContaining([{ source: 'adam', correlation_id: 'adam_corr_xyz' }]),
  );
  // Per-request correlation_id is recorded on the receipt inputs.
  expect(typeof call.inputs.correlation_id).toBe('string');
});
