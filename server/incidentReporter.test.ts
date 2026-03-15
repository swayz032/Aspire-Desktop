import {
  getIncidentReporterSecret,
  reportAdminIncident,
  resolveAdminIncidentUrl,
} from './incidentReporter';

describe('incidentReporter', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('resolves the admin incident report URL', () => {
    expect(resolveAdminIncidentUrl('http://localhost:8000/')).toBe(
      'http://localhost:8000/admin/ops/incidents/report',
    );
  });

  it('prefers the dedicated incident reporter secret', () => {
    process.env.ASPIRE_ADMIN_INCIDENT_S2S_SECRET = 'incident-secret';
    process.env.S2S_HMAC_SECRET_ACTIVE = 'fallback-secret';

    expect(getIncidentReporterSecret()).toBe('incident-secret');
  });

  it('posts incident payload with correlation headers', async () => {
    process.env.ASPIRE_ADMIN_INCIDENT_S2S_SECRET = 'incident-secret';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 202 }) as typeof fetch;

    const ok = await reportAdminIncident('http://localhost:8000', {
      title: 'Desktop proxy failed',
      correlationId: 'corr-123',
      traceId: 'trace-123',
      source: 'aspire_desktop',
      component: '/api/orchestrator/intent',
      fingerprint: 'desktop:intent:test',
      severity: 'sev2',
      errorCode: 'ORCHESTRATOR_TIMEOUT',
      suiteId: 'suite-123',
    });

    expect(ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/admin/ops/incidents/report',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer incident-secret',
          'X-Correlation-Id': 'corr-123',
          'X-Trace-Id': 'trace-123',
        }),
      }),
    );
  });
});
