/**
 * Tests for the show_cards server-side guard (Wave 2.4).
 *
 * Spins up the agentToolRoutes router on a random localhost port and exercises
 * POST /v1/tools/show-cards through real HTTP. This validates the route as a
 * black box, including the auth middleware and tenant isolation pattern.
 */

import http from 'http';
import type { AddressInfo } from 'net';

const ORIGINAL_ENV = { ...process.env };
const SUITE_A = '11111111-1111-4111-8111-111111111111';
const SUITE_B = '22222222-2222-4222-8222-222222222222';
const SHARED_SECRET = 'test-aspire-tool-secret';

// Env must be set BEFORE requiring agentToolRoutes so module init reads test
// values (auth secrets, default suite ID).
process.env.ASPIRE_TOOL_SECRET = SHARED_SECRET;
process.env.DEFAULT_SUITE_ID = SUITE_A;
process.env.NODE_ENV = 'test';

import express, { Express } from 'express';
import routerModule, { __testing__ as testingApi } from './agentToolRoutes';

let app: Express;
let server: http.Server;
let baseUrl: string;

function buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-aspire-tool-secret': SHARED_SECRET,
    ...extra,
  };
}

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use(routerModule);

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
  process.env = ORIGINAL_ENV;
});

beforeEach(() => {
  testingApi.cardRecordsCache.clear();
  testingApi.latestCardCacheIdBySuite.clear();
});

function seedCache(opts: {
  cacheId: string;
  suiteId: string;
  records: Array<Record<string, unknown>>;
  artifactType?: string;
  ageMs?: number;
  setLatest?: boolean;
}) {
  const timestamp = Date.now() - (opts.ageMs ?? 0);
  testingApi.cardRecordsCache.set(opts.cacheId, {
    records: opts.records,
    artifactType: opts.artifactType ?? 'PropertyFactPack',
    suiteId: opts.suiteId,
    timestamp,
  });
  if (opts.setLatest !== false) {
    testingApi.latestCardCacheIdBySuite.set(opts.suiteId, opts.cacheId);
  }
}

async function postShowCards(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const resp = await fetch(`${baseUrl}/v1/tools/show-cards`, {
    method: 'POST',
    headers: buildHeaders(headers),
    body: JSON.stringify(body),
  });
  const json = await resp.json().catch(() => ({}));
  return { status: resp.status, body: json as Record<string, unknown> };
}

describe('isSparseRecord', () => {
  it('flags records with fewer than 3 keys as sparse', () => {
    expect(testingApi.isSparseRecord({ name: 'X', address: 'Y' })).toBe(true);
    expect(testingApi.isSparseRecord({})).toBe(true);
    expect(testingApi.isSparseRecord(null)).toBe(true);
    expect(testingApi.isSparseRecord([])).toBe(true);
  });
  it('treats records with 3+ defined keys as full', () => {
    expect(testingApi.isSparseRecord({ a: 1, b: 2, c: 3 })).toBe(false);
    expect(testingApi.isSparseRecord({ a: 1, b: 2, c: 3, d: 4 })).toBe(false);
  });
  it('ignores undefined/null values when counting keys', () => {
    expect(testingApi.isSparseRecord({ a: 1, b: 2, c: undefined, d: null })).toBe(true);
  });
});

describe('POST /v1/tools/show-cards — auth + suite validation', () => {
  it('rejects requests without the shared secret', async () => {
    const resp = await fetch(`${baseUrl}/v1/tools/show-cards`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ suite_id: SUITE_A, records: [] }),
    });
    expect(resp.status).toBe(401);
  });

  it('returns 400 when suite_id cannot be resolved', async () => {
    // Override DEFAULT_SUITE_ID for this single call so the fallback can't fire.
    const prev = process.env.DEFAULT_SUITE_ID;
    process.env.DEFAULT_SUITE_ID = '';
    try {
      const { status, body } = await postShowCards({ records: [] });
      expect(status).toBe(400);
      expect(body.error).toBe('MISSING_SUITE_ID');
    } finally {
      process.env.DEFAULT_SUITE_ID = prev;
    }
  });
});

describe('POST /v1/tools/show-cards — explicit card_cache_id', () => {
  it('rehydrates from the exact cache_id when provided', async () => {
    const cacheId = 'corr-explicit-1';
    const fullRecords = [{ name: 'A', address: '1 Main', sqft: 1500 }];
    seedCache({
      cacheId,
      suiteId: SUITE_A,
      records: fullRecords,
      artifactType: 'PropertyFactPack',
    });

    const { status, body } = await postShowCards({
      suite_id: SUITE_A,
      card_cache_id: cacheId,
      records: [],
    });

    expect(status).toBe(200);
    expect(body.source).toBe('cache-by-id');
    expect(body.records).toEqual(fullRecords);
    expect(body.cacheId).toBe(cacheId);
    expect(body.artifactType).toBe('PropertyFactPack');
  });

  it('does NOT fall back to latest cache when an unknown cache_id is supplied', async () => {
    seedCache({
      cacheId: 'corr-latest',
      suiteId: SUITE_A,
      records: [{ name: 'A', address: '1 Main', sqft: 1500 }],
    });

    const { status, body } = await postShowCards({
      suite_id: SUITE_A,
      card_cache_id: 'corr-does-not-exist',
      records: [{ name: 'A', address: '1 Main' }],
    });

    expect(status).toBe(404);
    expect(body.error).toBe('CACHE_NOT_FOUND');
  });

  it('refuses cross-tenant rehydration (fail-closed Law #6)', async () => {
    const cacheId = 'corr-other-tenant';
    seedCache({
      cacheId,
      suiteId: SUITE_B,
      records: [{ name: 'Foreign', address: 'Other', sqft: 9999 }],
      setLatest: false,
    });

    const { status, body } = await postShowCards({
      suite_id: SUITE_A,
      card_cache_id: cacheId,
      records: [],
    });

    expect(status).toBe(404);
    expect(body.error).toBe('CACHE_NOT_FOUND');
    // Foreign records must NOT have leaked into the response.
    expect(body.records).toBeUndefined();
  });
});

describe('POST /v1/tools/show-cards — sparse-payload backstop', () => {
  it('rehydrates from latestCardCacheIdBySuite and logs a warn', async () => {
    const cacheId = 'corr-recent';
    const fullRecords = [
      { name: 'A', address: '1575 Paul Russell Rd APT 4802', sqft: 1620, price: 285000 },
    ];
    seedCache({
      cacheId,
      suiteId: SUITE_A,
      records: fullRecords,
      artifactType: 'PropertyFactPack',
    });

    // Sparse payload — exactly the regression Wave 2.4 catches.
    const { status, body } = await postShowCards({
      suite_id: SUITE_A,
      records: [{ name: 'A', address: '1575 Paul Russell Rd APT 4802' }],
      artifact_type: 'PropertyFactPack',
    });

    expect(status).toBe(200);
    expect(body.source).toBe('cache');
    expect(body.records).toEqual(fullRecords);
    expect(body.cacheId).toBe(cacheId);
  });

  it('passes through sparse records when no recent cache exists for the suite', async () => {
    const sparse = [{ name: 'A', address: '1 Main' }];
    const { status, body } = await postShowCards({
      suite_id: SUITE_A,
      records: sparse,
      artifact_type: 'PropertyFactPack',
    });

    expect(status).toBe(200);
    expect(body.source).toBe('client');
    expect(body.records).toEqual(sparse);
  });

  it('does NOT rehydrate from another suite\'s latest cache (fail-closed)', async () => {
    // Suite B has a recent cache; suite A does NOT. A request from suite A
    // with sparse records must not pick up suite B's cache.
    seedCache({
      cacheId: 'corr-suite-b',
      suiteId: SUITE_B,
      records: [{ name: 'Other', address: 'B', sqft: 999 }],
    });

    const sparse = [{ name: 'A', address: '1 Main' }];
    const { status, body } = await postShowCards({
      suite_id: SUITE_A,
      records: sparse,
      artifact_type: 'PropertyFactPack',
    });

    expect(status).toBe(200);
    expect(body.source).toBe('client');
    expect(body.records).toEqual(sparse);
  });
});

describe('POST /v1/tools/show-cards — full records pass-through', () => {
  it('returns the LLM payload unchanged when records are already full', async () => {
    const fullRecords = [
      { name: 'A', address: '1 Main', sqft: 1500, price: 250000 },
    ];

    const { status, body } = await postShowCards({
      suite_id: SUITE_A,
      records: fullRecords,
      artifact_type: 'PropertyFactPack',
      summary: 'Found 1 property.',
    });

    expect(status).toBe(200);
    expect(body.source).toBe('client');
    expect(body.records).toEqual(fullRecords);
    expect(body.summary).toBe('Found 1 property.');
  });
});
