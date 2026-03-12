export interface TraceHeaderOptions {
  correlationId?: string | null;
  traceId?: string | null;
}

function generateId(prefix: 'corr' | 'trace'): string {
  const randomUuid = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (typeof randomUuid === 'function') {
    return `${prefix}_${randomUuid()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeId(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildTraceHeaders(options: TraceHeaderOptions = {}) {
  const correlationId = normalizeId(options.correlationId) || generateId('corr');
  const traceId = normalizeId(options.traceId) || correlationId;

  return {
    correlationId,
    traceId,
    headers: {
      'X-Correlation-Id': correlationId,
      'X-Trace-Id': traceId,
    },
  };
}
