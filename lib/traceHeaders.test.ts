import { buildTraceHeaders } from './traceHeaders';

describe('buildTraceHeaders', () => {
  it('reuses provided correlation and trace ids', () => {
    const trace = buildTraceHeaders({
      correlationId: 'corr-existing',
      traceId: 'trace-existing',
    });

    expect(trace.correlationId).toBe('corr-existing');
    expect(trace.traceId).toBe('trace-existing');
    expect(trace.headers['X-Correlation-Id']).toBe('corr-existing');
    expect(trace.headers['X-Trace-Id']).toBe('trace-existing');
  });

  it('defaults trace id to correlation id', () => {
    const trace = buildTraceHeaders({ correlationId: 'corr-only' });

    expect(trace.correlationId).toBe('corr-only');
    expect(trace.traceId).toBe('corr-only');
  });

  it('generates ids when missing', () => {
    const trace = buildTraceHeaders();

    expect(trace.correlationId).toMatch(/^corr_/);
    expect(trace.traceId).toBe(trace.correlationId);
  });
});
