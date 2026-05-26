/**
 * receiptLatencyLog — DV Pass 5.
 *
 * Module-level FIFO of receipt-fetch latency samples (ms). `useExtractionReceipt`
 * pushes a sample on every successful fetch, gated on `__DEV__` so production
 * bundles strip the call site at Metro minification.
 *
 * Capped at MAX_SAMPLES. When the cap is reached, the oldest sample is shifted
 * off — no allocation churn, no unbounded memory in long QA sessions.
 *
 * Consumed by `DrewVisibilityHUD` to compute p50 / p95 latencies. Tests can
 * read or reset via the exported helpers.
 *
 * Law #7: pure in-memory diagnostic buffer; no decisions, no I/O.
 * Law #9: stores only latency numbers — never receipt bodies, never IDs.
 */
const MAX_SAMPLES = 100;

const samples: number[] = [];

/** Append a latency sample (ms). Drops the oldest if cap is hit. */
export function pushReceiptLatency(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  samples.push(ms);
  if (samples.length > MAX_SAMPLES) {
    samples.shift();
  }
}

/** Return a snapshot copy of all samples — never mutate the live buffer. */
export function getReceiptLatencies(): number[] {
  return samples.slice();
}

/** Test helper — wipe the buffer between describe blocks. */
export function _resetReceiptLatencyLogForTests(): void {
  samples.length = 0;
}
