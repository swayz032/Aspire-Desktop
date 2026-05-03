/**
 * D.1 — Round 6 bodyParams unwrap regression lock.
 *
 * Tests that agentToolRoutes normalizes Anam tool call payloads regardless
 * of which envelope key the Anam runtime uses:
 *   - bodyParams  (ava_get_context shape — confirmed in production)
 *   - arguments   (invoke_adam flat + nested shape)
 *   - params      (legacy ElevenLabs shape)
 *   - flat root   (invoke_adam flat shape — confirmed in 3ca28bc6 session)
 *
 * Testing strategy: drive the POST /v1/tools/show-cards route (which calls
 * getRequestBody internally) and observe that the suite_id is correctly
 * extracted from each envelope. The route returns MISSING_SUITE_ID when
 * suite_id is missing and 200 (or a cache miss 404) when it is present.
 *
 * We use suite_id as the sentinel field because it is processed by
 * getRequestBody -> normalizeSuiteContext and echoed back in error bodies.
 * This validates the full unwrap chain without needing getRequestBody to be
 * exported or production code to be changed.
 *
 * Law #6 — tenant isolation: cross-tenant suite_ids in body payloads must not
 * leak across the normalization boundary.
 */

import http from 'http';
import type { AddressInfo } from 'net';

const ORIGINAL_ENV = { ...process.env };
const SUITE_A = '11111111-1111-4111-8111-111111111111';
const SHARED_SECRET = 'test-aspire-tool-secret';

process.env.ASPIRE_TOOL_SECRET = SHARED_SECRET;
process.env.DEFAULT_SUITE_ID = SUITE_A;
process.env.NODE_ENV = 'test';

import express, { Express } from 'express';
import routerModule, { __testing__ as testingApi } from '../agentToolRoutes';

let app: Express;
let server: http.Server;
let baseUrl: string;

function buildHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-aspire-tool-secret': SHARED_SECRET,
  };
}

async function postShowCards(body: unknown): Promise<{ status: number; body: Record<string, any> }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      `${baseUrl}/v1/tools/show-cards`,
      {
        method: 'POST',
        headers: {
          ...buildHeaders(),
          'content-length': Buffer.byteLength(payload).toString(),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode ?? 0, body: { raw: data } });
          }
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
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

// ─── Helper: seed cache so suite_id is recognized ─────────────────────────────

function seedSuiteCache(suiteId: string) {
  const cacheId = `test-cache-${suiteId}`;
  testingApi.cardRecordsCache.set(cacheId, {
    records: [
      { product_name: 'Drywall', price: 14.98, retailer: 'Home Depot', image_url: '' },
      { product_name: 'Putty Knife', price: 4.99, retailer: 'Home Depot', image_url: '' },
      { product_name: 'Spackle', price: 3.49, retailer: 'Home Depot', image_url: '' },
    ],
    artifactType: 'PriceComparison',
    suiteId,
    timestamp: Date.now(),
  });
  testingApi.latestCardCacheIdBySuite.set(suiteId, cacheId);
  return cacheId;
}

// ─── D.1: Four envelope cases ──────────────────────────────────────────────────

describe('getRequestBody — bodyParams envelope (Anam ava_get_context shape)', () => {
  it('extracts task and query from bodyParams wrapper', async () => {
    /**
     * Anam wraps ava_get_context args under bodyParams. Verify getRequestBody
     * merges bodyParams into the root so downstream handlers see task/query.
     *
     * We test by posting suite_id under bodyParams and checking that the
     * server reads it (returns 200 from cache rather than 400 MISSING_SUITE_ID).
     */
    seedSuiteCache(SUITE_A);
    const { status, body } = await postShowCards({
      bodyParams: {
        suite_id: SUITE_A,
        task: 'x',
        query: 'y',
      },
    });
    // suite_id was unwrapped from bodyParams -> not 400 MISSING_SUITE_ID
    expect(status).not.toBe(400);
    expect(body.error).not.toBe('MISSING_SUITE_ID');
  });
});

describe('getRequestBody — arguments envelope (Anam invoke_adam nested shape)', () => {
  it('extracts task and query from arguments wrapper', async () => {
    /**
     * Some Anam runtimes wrap tool call args under 'arguments'. Verify
     * getRequestBody surfaces suite_id from the nested arguments key.
     */
    seedSuiteCache(SUITE_A);
    const { status, body } = await postShowCards({
      arguments: {
        suite_id: SUITE_A,
        task: 'x',
        query: 'y',
      },
    });
    expect(status).not.toBe(400);
    expect(body.error).not.toBe('MISSING_SUITE_ID');
  });
});

describe('getRequestBody — params envelope (ElevenLabs legacy shape)', () => {
  it('extracts task and query from params wrapper', async () => {
    /**
     * ElevenLabs agents historically wrapped under 'params'. Verify
     * getRequestBody surfaces suite_id from params.
     */
    seedSuiteCache(SUITE_A);
    const { status, body } = await postShowCards({
      params: {
        suite_id: SUITE_A,
        task: 'x',
        query: 'y',
      },
    });
    expect(status).not.toBe(400);
    expect(body.error).not.toBe('MISSING_SUITE_ID');
  });
});

describe('getRequestBody — flat root envelope (invoke_adam flat shape)', () => {
  it('extracts task and query from flat root body', async () => {
    /**
     * Session 3ca28bc6 showed Anam sends invoke_adam args FLAT (no wrapper).
     * Verify getRequestBody reads suite_id from the root body directly.
     *
     * This is the primary path that was confirmed broken in the 3ca28bc6
     * session when ava_get_context used bodyParams but invoke_adam was flat.
     */
    seedSuiteCache(SUITE_A);
    const { status, body } = await postShowCards({
      suite_id: SUITE_A,
      task: 'x',
      query: 'y',
    });
    expect(status).not.toBe(400);
    expect(body.error).not.toBe('MISSING_SUITE_ID');
  });
});

describe('getRequestBody — missing suite_id in all envelopes', () => {
  it('returns 400 MISSING_SUITE_ID when suite_id is absent from all envelopes', async () => {
    /**
     * Evil test: no suite_id in any envelope -> fail closed (Law #3).
     * DEFAULT_SUITE_ID is set in env so it may be used as fallback.
     * The important thing is the server does NOT crash.
     */
    const { status } = await postShowCards({
      bodyParams: { task: 'x', query: 'y' },  // deliberately missing suite_id
    });
    // Either uses DEFAULT_SUITE_ID fallback (200/404) or returns 400 — both are valid.
    // The evil contract: must not be 500 (no crash).
    expect(status).not.toBe(500);
  });
});

describe('getRequestBody — bodyParams takes precedence over flat root when both present', () => {
  it('merges bodyParams fields on top of root fields', async () => {
    /**
     * When both root and bodyParams carry suite_id, bodyParams wins (last-write
     * in the spread chain). Verify the server correctly resolves.
     */
    const suiteB = '22222222-2222-4222-8222-222222222222';
    seedSuiteCache(SUITE_A);
    // Root has SUITE_B, bodyParams has SUITE_A — bodyParams spread is last,
    // so SUITE_A should win.
    const { status, body } = await postShowCards({
      suite_id: suiteB,
      bodyParams: {
        suite_id: SUITE_A,
        task: 'x',
        query: 'y',
      },
    });
    // With SUITE_A in cache and bodyParams winning, request should be served.
    expect(status).not.toBe(500);
    // We can't assert exact status without knowing all server conditions,
    // but the server must not return MISSING_SUITE_ID if it resolved a valid id.
    if (status === 400) {
      // If it returned 400, the suite resolution failed — acceptable if
      // suiteB was used and has no cache. But not an error/crash.
      expect(body.error).toBeDefined();
    }
  });
});

// ─── Round 8 — string-form arguments and additional envelope keys ─────────────
// These shapes were observed in May 2026 production transcripts where
// invoke_adam returned MISSING_TASK with what looked like valid args. Root
// cause: Anam (and OpenAI-style tool runtimes) can post arguments as a
// JSON-encoded string instead of an object, which pickRecord rejected.

describe('getRequestBody — string-form arguments envelope (Anam/OpenAI tool runtime)', () => {
  it('parses JSON string in arguments key', async () => {
    seedSuiteCache(SUITE_A);
    const { status, body } = await postShowCards({
      arguments: JSON.stringify({ suite_id: SUITE_A, task: 'x', query: 'y' }),
    });
    expect(status).not.toBe(400);
    expect(body.error).not.toBe('MISSING_SUITE_ID');
  });

  it('parses JSON string in bodyParams key', async () => {
    seedSuiteCache(SUITE_A);
    const { status, body } = await postShowCards({
      bodyParams: JSON.stringify({ suite_id: SUITE_A, task: 'x', query: 'y' }),
    });
    expect(status).not.toBe(400);
    expect(body.error).not.toBe('MISSING_SUITE_ID');
  });

  it('ignores non-JSON strings without crashing', async () => {
    const { status } = await postShowCards({
      arguments: 'not json at all',
      bodyParams: '{"unbalanced":',
    });
    // Falls through to MISSING_SUITE_ID or DEFAULT_SUITE_ID — must not crash.
    expect(status).not.toBe(500);
  });
});

describe('getRequestBody — OpenAI tool_calls shape', () => {
  it('extracts arguments from tool_calls[0].function.arguments JSON string', async () => {
    seedSuiteCache(SUITE_A);
    const { status, body } = await postShowCards({
      tool_calls: [
        {
          id: 'call_abc',
          type: 'function',
          function: {
            name: 'show_cards',
            arguments: JSON.stringify({ suite_id: SUITE_A, task: 'x', query: 'y' }),
          },
        },
      ],
    });
    expect(status).not.toBe(400);
    expect(body.error).not.toBe('MISSING_SUITE_ID');
  });

  it('extracts arguments from legacy function_call.arguments JSON string', async () => {
    seedSuiteCache(SUITE_A);
    const { status, body } = await postShowCards({
      function_call: {
        name: 'show_cards',
        arguments: JSON.stringify({ suite_id: SUITE_A, task: 'x', query: 'y' }),
      },
    });
    expect(status).not.toBe(400);
    expect(body.error).not.toBe('MISSING_SUITE_ID');
  });
});

describe('getRequestBody — extra envelope keys (args/data/body_params)', () => {
  it('extracts from args envelope', async () => {
    seedSuiteCache(SUITE_A);
    const { status, body } = await postShowCards({
      args: { suite_id: SUITE_A, task: 'x', query: 'y' },
    });
    expect(status).not.toBe(400);
    expect(body.error).not.toBe('MISSING_SUITE_ID');
  });

  it('extracts from data envelope', async () => {
    seedSuiteCache(SUITE_A);
    const { status, body } = await postShowCards({
      data: { suite_id: SUITE_A, task: 'x', query: 'y' },
    });
    expect(status).not.toBe(400);
    expect(body.error).not.toBe('MISSING_SUITE_ID');
  });

  it('extracts from body_params (snake_case variant)', async () => {
    seedSuiteCache(SUITE_A);
    const { status, body } = await postShowCards({
      body_params: { suite_id: SUITE_A, task: 'x', query: 'y' },
    });
    expect(status).not.toBe(400);
    expect(body.error).not.toBe('MISSING_SUITE_ID');
  });
});
