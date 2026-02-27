import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CanvasTelemetryEvent =
  | 'mode_change'
  | 'stage_open'
  | 'stage_close'
  | 'runway_step'
  | 'lens_open'
  | 'lens_close'
  | 'dry_run_start'
  | 'dry_run_end'
  | 'command_palette_open'
  | 'sound_play'
  | 'fallback_trigger'
  | 'slo_violation'
  | 'error';

export interface TelemetryPayload {
  event: CanvasTelemetryEvent;
  timestamp: number;
  sessionId: string;
  cohort: string;
  data: Record<string, string | number | boolean>;
}

export interface SessionMetrics {
  sessionId: string;
  startTime: number;
  eventCounts: Record<CanvasTelemetryEvent, number>;
  sloViolations: number;
  modeChanges: number;
  stageOpenCount: number;
  avgFps: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_THRESHOLD = 20;
const TELEMETRY_ENDPOINT = '/api/telemetry/canvas';

// ---------------------------------------------------------------------------
// Session ID — generated once per page load
// ---------------------------------------------------------------------------

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const sessionId: string = generateSessionId();
let cohort = 'control';

// ---------------------------------------------------------------------------
// Session metrics — aggregated per page-load session
// ---------------------------------------------------------------------------

function createEmptyEventCounts(): Record<CanvasTelemetryEvent, number> {
  return {
    mode_change: 0,
    stage_open: 0,
    stage_close: 0,
    runway_step: 0,
    lens_open: 0,
    lens_close: 0,
    dry_run_start: 0,
    dry_run_end: 0,
    command_palette_open: 0,
    sound_play: 0,
    fallback_trigger: 0,
    slo_violation: 0,
    error: 0,
  };
}

let sessionMetrics: SessionMetrics = {
  sessionId,
  startTime: Date.now(),
  eventCounts: createEmptyEventCounts(),
  sloViolations: 0,
  modeChanges: 0,
  stageOpenCount: 0,
  avgFps: 60,
};

// Rolling FPS tracking for session average
let fpsSampleCount = 0;
let fpsSampleSum = 0;

// ---------------------------------------------------------------------------
// Queue state
// ---------------------------------------------------------------------------

let queue: TelemetryPayload[] = [];
let flushTimerId: ReturnType<typeof setTimeout> | null = null;
let isDev = false;

// Detect development mode safely
try {
  isDev = __DEV__ === true;
} catch {
  isDev = false;
}

// ---------------------------------------------------------------------------
// Flush logic — fire-and-forget, never blocks UI
// ---------------------------------------------------------------------------

function scheduleFlush(): void {
  if (flushTimerId !== null) return;
  flushTimerId = setTimeout(() => {
    flushTimerId = null;
    flushTelemetry().catch(() => {
      // silent — telemetry is best-effort
    });
  }, FLUSH_INTERVAL_MS);
}

export async function flushTelemetry(): Promise<void> {
  if (queue.length === 0) return;

  const batch = queue;
  queue = [];

  if (flushTimerId !== null) {
    clearTimeout(flushTimerId);
    flushTimerId = null;
  }

  if (isDev) {
    // Development: log to console, don't POST
    for (const payload of batch) {
      // eslint-disable-next-line no-console
      console.debug('[canvas-telemetry]', payload.event, payload.data);
    }
    return;
  }

  // Production: fire-and-forget POST — no retry on failure
  if (Platform.OS !== 'web') return;

  try {
    await fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
    });
  } catch {
    // silent — telemetry must never break the app
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function emitCanvasEvent(
  event: CanvasTelemetryEvent,
  data: Record<string, string | number | boolean> = {},
): void {
  const payload: TelemetryPayload = {
    event,
    timestamp: Date.now(),
    sessionId,
    cohort,
    data,
  };

  queue.push(payload);

  // Update session metrics
  sessionMetrics.eventCounts[event] += 1;
  if (event === 'mode_change') sessionMetrics.modeChanges += 1;
  if (event === 'stage_open') sessionMetrics.stageOpenCount += 1;
  if (event === 'slo_violation') sessionMetrics.sloViolations += 1;

  if (queue.length >= FLUSH_THRESHOLD) {
    flushTelemetry().catch(() => {
      // silent
    });
  } else {
    scheduleFlush();
  }
}

export function getTelemetryQueue(): readonly TelemetryPayload[] {
  return queue;
}

export function clearTelemetryQueue(): void {
  queue = [];
  if (flushTimerId !== null) {
    clearTimeout(flushTimerId);
    flushTimerId = null;
  }
}

// ---------------------------------------------------------------------------
// Session metrics API
// ---------------------------------------------------------------------------

/**
 * Returns aggregated session metrics. Safe to call from hot paths.
 */
export function getSessionMetrics(): SessionMetrics {
  // Update avgFps from rolling samples
  if (fpsSampleCount > 0) {
    sessionMetrics.avgFps = Math.round(fpsSampleSum / fpsSampleCount);
  }
  return { ...sessionMetrics, eventCounts: { ...sessionMetrics.eventCounts } };
}

/**
 * Reset all session metrics (e.g., on mode change or manual reset).
 */
export function resetSessionMetrics(): void {
  sessionMetrics = {
    sessionId,
    startTime: Date.now(),
    eventCounts: createEmptyEventCounts(),
    sloViolations: 0,
    modeChanges: 0,
    stageOpenCount: 0,
    avgFps: 60,
  };
  fpsSampleCount = 0;
  fpsSampleSum = 0;
}

/**
 * Record an FPS sample for session-level average tracking.
 * Called from useFpsMonitor or fallbackEngine — lightweight, no telemetry emit.
 */
export function recordFpsSample(fps: number): void {
  fpsSampleCount += 1;
  fpsSampleSum += fps;
}

/**
 * Set the A/B cohort identifier for this session.
 * Must be called before any events are emitted for correct tagging.
 */
export function setCohort(newCohort: string): void {
  cohort = newCohort;
}
