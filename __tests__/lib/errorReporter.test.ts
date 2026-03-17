/**
 * Tests for lib/errorReporter.ts
 */
import { reportError, _resetRateLimiter } from '@/lib/errorReporter';

// Mock fetch globally
const mockFetch = jest.fn().mockResolvedValue({ ok: true });
(globalThis as any).fetch = mockFetch;

// Mock traceHeaders
jest.mock('@/lib/traceHeaders', () => ({
  buildTraceHeaders: () => ({
    correlationId: 'corr_test-123',
    traceId: 'corr_test-123',
    headers: {
      'X-Correlation-Id': 'corr_test-123',
      'X-Trace-Id': 'corr_test-123',
    },
  }),
}));

describe('reportError', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    _resetRateLimiter();
  });

  it('sends a POST request with correct payload', async () => {
    await reportError({
      title: 'Test error',
      severity: 'sev3',
      component: 'test-component',
      message: 'Something broke',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/admin/ops/incidents/report');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.title).toBe('Test error');
    expect(body.severity).toBe('sev3');
    expect(body.source).toBe('desktop');
    expect(body.component).toBe('test-component');
    expect(body.message).toBe('Something broke');
  });

  it('defaults severity to sev3 and source to desktop', async () => {
    await reportError({ title: 'Minimal error' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.severity).toBe('sev3');
    expect(body.source).toBe('desktop');
  });

  it('includes trace headers', async () => {
    await reportError({ title: 'Traced error' });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['X-Correlation-Id']).toBe('corr_test-123');
    expect(headers['X-Trace-Id']).toBe('corr_test-123');
  });

  it('rate-limits to 5 reports per window', async () => {
    for (let i = 0; i < 8; i++) {
      await reportError({ title: `Error ${i}` });
    }

    expect(mockFetch).toHaveBeenCalledTimes(5);
  });

  it('never throws even if fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(
      reportError({ title: 'Should not throw' }),
    ).resolves.toBeUndefined();
  });

  it('truncates stack trace to 4000 chars', async () => {
    const longStack = 'x'.repeat(5000);
    await reportError({ title: 'Long stack', stackTrace: longStack });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.stack_trace.length).toBe(4000);
  });

  it('truncates message to 1000 chars', async () => {
    const longMsg = 'y'.repeat(2000);
    await reportError({ title: 'Long msg', message: longMsg });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.message.length).toBe(1000);
  });
});
