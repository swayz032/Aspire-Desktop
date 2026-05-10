/**
 * Tests for the /api/service-hub/property-data Express route.
 *
 * The aggregator is mocked — these tests verify only the HTTP contract:
 *   - 401 when authenticated suite missing
 *   - 400 when address invalid/empty/too long
 *   - 200 ok with PropertyData
 *   - 200 needs_correction with suggestedAddress + propertyData:null
 *   - 422 ADDRESS_INVALID with verdict
 *   - 500 when aggregator throws
 *
 * supertest is not in this repo's deps — we drive the express app through
 * an in-process HTTP server using Node's built-in fetch.
 */

jest.mock('../../../../server/serviceHub/property/propertyAggregator', () => ({
  __esModule: true,
  aggregatePropertyData: jest.fn(),
}));

import express from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import propertyRoutes from '../../../../server/serviceHub/property/propertyRoutes';
import { aggregatePropertyData } from '../../../../server/serviceHub/property/propertyAggregator';

const mkAgg = aggregatePropertyData as unknown as jest.Mock;

const DEFAULT_SUITE = '11111111-1111-1111-1111-111111111111';
function makeApp(opts: { suiteId?: string | null } = { suiteId: DEFAULT_SUITE }) {
  const suiteId = opts.suiteId; // null => no auth
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (suiteId) {
      (req as unknown as { authenticatedSuiteId: string }).authenticatedSuiteId = suiteId;
      (req as unknown as { authenticatedOfficeId: string }).authenticatedOfficeId = suiteId;
    }
    next();
  });
  app.use(propertyRoutes);
  return app;
}

async function startServer(app: express.Express): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function postJson(
  baseUrl: string,
  path: string,
  body: unknown,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('returns 401 when no authenticated suite', async () => {
  const srv = await startServer(makeApp({ suiteId: null }));
  try {
    const res = await postJson(srv.url, '/api/service-hub/property-data', { address: '1234 Industrial Way' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('AUTH_REQUIRED');
  } finally {
    await srv.close();
  }
});

test('returns 400 when address missing', async () => {
  const srv = await startServer(makeApp());
  try {
    const res = await postJson(srv.url, '/api/service-hub/property-data', {});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ADDRESS_REQUIRED');
  } finally {
    await srv.close();
  }
});

test('returns 400 when address too long', async () => {
  const srv = await startServer(makeApp());
  try {
    const res = await postJson(srv.url, '/api/service-hub/property-data', { address: 'x'.repeat(500) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ADDRESS_TOO_LONG');
  } finally {
    await srv.close();
  }
});

test('returns 200 + PropertyData on ok', async () => {
  const fakeData = { address: { formatted: '1234 Industrial Way' }, sources: [] };
  mkAgg.mockResolvedValue({ kind: 'ok', data: fakeData, cacheHit: false });
  const srv = await startServer(makeApp());
  try {
    const res = await postJson(srv.url, '/api/service-hub/property-data', { address: '1234 Industrial Way' });
    expect(res.status).toBe(200);
    expect(res.body.address.formatted).toBe('1234 Industrial Way');
  } finally {
    await srv.close();
  }
});

test('returns 200 + correction payload on needs_correction', async () => {
  mkAgg.mockResolvedValue({
    kind: 'needs_correction',
    payload: {
      suggestedAddress: '1234 Industrial Way, Austin, TX 78758',
      components: { city: 'Austin' },
      propertyData: null,
    },
  });
  const srv = await startServer(makeApp());
  try {
    const res = await postJson(srv.url, '/api/service-hub/property-data', { address: '1234 industrial way austin' });
    expect(res.status).toBe(200);
    expect(res.body.suggestedAddress).toBe('1234 Industrial Way, Austin, TX 78758');
    expect(res.body.propertyData).toBeNull();
  } finally {
    await srv.close();
  }
});

test('returns 422 ADDRESS_INVALID on invalid', async () => {
  mkAgg.mockResolvedValue({
    kind: 'invalid',
    verdict: { status: 'invalid', reason: 'undeliverable', fetchedAt: '2026-05-10T12:00:00Z' },
  });
  const srv = await startServer(makeApp());
  try {
    const res = await postJson(srv.url, '/api/service-hub/property-data', { address: '123 Fake St' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('ADDRESS_INVALID');
    expect(res.body.verdict.status).toBe('invalid');
  } finally {
    await srv.close();
  }
});

test('returns 500 when aggregator throws', async () => {
  mkAgg.mockRejectedValue(new Error('boom'));
  const srv = await startServer(makeApp());
  try {
    const res = await postJson(srv.url, '/api/service-hub/property-data', { address: '1234 Industrial Way' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('AGGREGATOR_FAILED');
  } finally {
    await srv.close();
  }
});

test('forceRefresh flag is forwarded to aggregator', async () => {
  mkAgg.mockResolvedValue({ kind: 'ok', data: { sources: [] }, cacheHit: false });
  const srv = await startServer(makeApp());
  try {
    await postJson(srv.url, '/api/service-hub/property-data', { address: '1234 Industrial Way', forceRefresh: true });
    expect(mkAgg).toHaveBeenCalledWith(
      '1234 Industrial Way',
      expect.objectContaining({ forceRefresh: true }),
    );
  } finally {
    await srv.close();
  }
});
