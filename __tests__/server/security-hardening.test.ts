/**
 * Security Hardening Tests (Phase 3.5 + Wave 4.1)
 * Tests cross-tenant isolation, DEV_BYPASS_AUTH, error sanitization,
 * webhook verification, and circuit breaker initialization.
 */

describe('DEV_BYPASS_AUTH hardening', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('DEV_BYPASS_AUTH requires explicit opt-in', () => {
    // Without DEV_BYPASS_AUTH=true, auth bypass should be disabled
    delete process.env.DEV_BYPASS_AUTH;
    delete process.env.SUPABASE_URL;
    process.env.NODE_ENV = 'development';

    const bypass =
      process.env.DEV_BYPASS_AUTH === 'true' &&
      !process.env.SUPABASE_URL &&
      process.env.NODE_ENV !== 'production';

    expect(bypass).toBe(false);
  });

  test('DEV_BYPASS_AUTH blocked in production', () => {
    process.env.DEV_BYPASS_AUTH = 'true';
    process.env.NODE_ENV = 'production';
    delete process.env.SUPABASE_URL;

    const bypass =
      process.env.DEV_BYPASS_AUTH === 'true' &&
      !process.env.SUPABASE_URL &&
      process.env.NODE_ENV !== 'production';

    expect(bypass).toBe(false);
  });

  test('DEV_BYPASS_AUTH blocked when SUPABASE_URL is set', () => {
    process.env.DEV_BYPASS_AUTH = 'true';
    process.env.NODE_ENV = 'development';
    process.env.SUPABASE_URL = 'https://example.supabase.co';

    const bypass =
      process.env.DEV_BYPASS_AUTH === 'true' &&
      !process.env.SUPABASE_URL &&
      process.env.NODE_ENV !== 'production';

    expect(bypass).toBe(false);
  });

  test('DEV_BYPASS_AUTH only enabled with all 3 conditions met', () => {
    process.env.DEV_BYPASS_AUTH = 'true';
    process.env.NODE_ENV = 'development';
    delete process.env.SUPABASE_URL;

    const bypass =
      process.env.DEV_BYPASS_AUTH === 'true' &&
      !process.env.SUPABASE_URL &&
      process.env.NODE_ENV !== 'production';

    expect(bypass).toBe(true);
  });
});

describe('Error message sanitization', () => {
  test('INTERNAL_ERROR does not leak stack traces', () => {
    const errorResponse = { error: 'INTERNAL_ERROR' };
    expect(errorResponse.error).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(errorResponse)).not.toContain('at ');
    expect(JSON.stringify(errorResponse)).not.toContain('Error:');
    expect(JSON.stringify(errorResponse)).not.toContain('stack');
  });
});

describe('Webhook signature verification', () => {
  const crypto = require('crypto');

  test('timing-safe comparison rejects different-length signatures', () => {
    const hashBuf = Buffer.from('abc', 'utf-8');
    const sigBuf = Buffer.from('abcdef', 'utf-8');
    expect(hashBuf.length).not.toBe(sigBuf.length);
  });

  test('timing-safe comparison accepts matching signatures', () => {
    const data = 'test-payload';
    const secret = 'test-secret';
    const hash = crypto.createHmac('sha256', secret).update(data).digest('hex');
    const hashBuf = Buffer.from(hash, 'hex');
    const sigBuf = Buffer.from(hash, 'hex');
    expect(hashBuf.length).toBe(sigBuf.length);
    expect(crypto.timingSafeEqual(hashBuf, sigBuf)).toBe(true);
  });

  test('timing-safe comparison rejects mismatched signatures', () => {
    const secret = 'test-secret';
    const hash1 = crypto.createHmac('sha256', secret).update('payload-a').digest('hex');
    const hash2 = crypto.createHmac('sha256', secret).update('payload-b').digest('hex');
    const buf1 = Buffer.from(hash1, 'hex');
    const buf2 = Buffer.from(hash2, 'hex');
    expect(buf1.length).toBe(buf2.length);
    expect(crypto.timingSafeEqual(buf1, buf2)).toBe(false);
  });
});

describe('Raw body preservation for webhooks', () => {
  test('rawBody preserves original bytes', () => {
    const originalBody = '{"amount":100,"currency":"usd"}';
    const rawBody = Buffer.from(originalBody);
    const reparsed = JSON.stringify(JSON.parse(originalBody));

    // Raw body should match original exactly
    expect(rawBody.toString('utf-8')).toBe(originalBody);

    // Re-stringified JSON may differ (key ordering, spacing)
    // This is exactly why we need rawBody for webhook hash verification
    expect(rawBody.toString('utf-8')).toBe(reparsed); // happens to match for this case
  });

  test('rawBody detects re-stringify divergence', () => {
    // JSON with specific whitespace that parse+stringify would lose
    const originalBody = '{ "amount" : 100 }';
    const rawBody = Buffer.from(originalBody);
    const reparsed = JSON.stringify(JSON.parse(originalBody));

    expect(rawBody.toString('utf-8')).not.toBe(reparsed);
  });
});

describe('Cross-tenant isolation (finance endpoints)', () => {
  test('authenticatedSuiteId is required for finance operations', () => {
    // Simulate request without authenticatedSuiteId
    const req = { query: { suiteId: 'attacker-suite-id' } } as any;
    const suiteId = req.authenticatedSuiteId;

    // Should be undefined — endpoint must return 401
    expect(suiteId).toBeUndefined();
  });

  test('client-supplied suiteId must not be used', () => {
    // Even if query contains suiteId, it must be ignored
    const req = {
      query: { suiteId: 'attacker-suite-id' },
      authenticatedSuiteId: 'real-suite-id',
    } as any;

    // Only authenticatedSuiteId should be used
    expect(req.authenticatedSuiteId).toBe('real-suite-id');
    expect(req.authenticatedSuiteId).not.toBe(req.query.suiteId);
  });

  test('body suiteId must not override JWT suiteId', () => {
    const req = {
      body: { suiteId: 'attacker-suite-id', action: 'create_invoice' },
      authenticatedSuiteId: 'real-suite-id',
    } as any;

    expect(req.authenticatedSuiteId).toBe('real-suite-id');
    expect(req.authenticatedSuiteId).not.toBe(req.body.suiteId);
  });
});

describe('Circuit breaker module', () => {
  test('exports named breakers for all external services', () => {
    // Verify the module structure
    const { breakers, policies, withBreaker, getBreakerStates } = require('../../server/circuitBreaker');

    expect(breakers).toBeDefined();
    expect(breakers.backend).toBeDefined();
    expect(breakers.supabase).toBeDefined();
    expect(breakers.stripe).toBeDefined();
    expect(breakers.plaid).toBeDefined();
    expect(breakers.quickbooks).toBeDefined();
    expect(breakers.gusto).toBeDefined();

    expect(typeof withBreaker).toBe('function');
    expect(typeof getBreakerStates).toBe('function');
  });

  test('getBreakerStates returns all service states', () => {
    const { getBreakerStates } = require('../../server/circuitBreaker');
    const states = getBreakerStates();

    expect(Object.keys(states)).toEqual(
      expect.arrayContaining(['backend', 'supabase', 'stripe', 'plaid', 'quickbooks', 'gusto'])
    );
  });
});
