// ---------------------------------------------------------------------------
// Runway State Machine — 12-state pure function machine
// Mirrors the Aspire execution pipeline:
//   Intent -> Preflight -> Draft -> Authority -> Execute -> Receipt
// ---------------------------------------------------------------------------

import { emitCanvasEvent } from '@/lib/canvasTelemetry';

// ---------------------------------------------------------------------------
// Types (re-export RunwayState from immersionStore for consistency)
// ---------------------------------------------------------------------------

export type RunwayState =
  | 'IDLE'
  | 'PREFLIGHT'
  | 'DRAFT_CREATING'
  | 'DRAFT_READY'
  | 'AUTHORITY_SUBMITTING'
  | 'AUTHORITY_PENDING'
  | 'AUTHORITY_APPROVED'
  | 'EXECUTING'
  | 'RECEIPT_READY'
  | 'ERROR'
  | 'CANCELLED'
  | 'TIMEOUT';

export type RunwayEvent =
  | 'START_INTENT'
  | 'PREFLIGHT_OK'
  | 'DRAFT_COMPLETE'
  | 'SUBMIT_AUTHORITY'
  | 'AUTHORITY_RECEIVED'
  | 'APPROVE'
  | 'DENY'
  | 'EXECUTE'
  | 'EXECUTION_COMPLETE'
  | 'ERROR'
  | 'CANCEL'
  | 'TIMEOUT'
  | 'RESET';

export interface RunwayTransition {
  from: RunwayState;
  to: RunwayState;
  event: RunwayEvent;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Terminal & active states
// ---------------------------------------------------------------------------

const TERMINAL_STATES: ReadonlySet<RunwayState> = new Set([
  'RECEIPT_READY',
  'ERROR',
  'CANCELLED',
  'TIMEOUT',
]);

const ACTIVE_STATES: ReadonlySet<RunwayState> = new Set([
  'PREFLIGHT',
  'DRAFT_CREATING',
  'DRAFT_READY',
  'AUTHORITY_SUBMITTING',
  'AUTHORITY_PENDING',
  'AUTHORITY_APPROVED',
  'EXECUTING',
]);

// ---------------------------------------------------------------------------
// Transition table — deterministic, no side effects except telemetry
// ---------------------------------------------------------------------------

type TransitionMap = Partial<Record<RunwayEvent, RunwayState>>;

const TRANSITIONS: Record<RunwayState, TransitionMap> = {
  IDLE: {
    START_INTENT: 'PREFLIGHT',
  },
  PREFLIGHT: {
    PREFLIGHT_OK: 'DRAFT_CREATING',
    ERROR: 'ERROR',
    CANCEL: 'CANCELLED',
    TIMEOUT: 'TIMEOUT',
  },
  DRAFT_CREATING: {
    DRAFT_COMPLETE: 'DRAFT_READY',
    ERROR: 'ERROR',
    CANCEL: 'CANCELLED',
    TIMEOUT: 'TIMEOUT',
  },
  DRAFT_READY: {
    SUBMIT_AUTHORITY: 'AUTHORITY_SUBMITTING',
    ERROR: 'ERROR',
    CANCEL: 'CANCELLED',
    TIMEOUT: 'TIMEOUT',
  },
  AUTHORITY_SUBMITTING: {
    AUTHORITY_RECEIVED: 'AUTHORITY_PENDING',
    ERROR: 'ERROR',
    CANCEL: 'CANCELLED',
    TIMEOUT: 'TIMEOUT',
  },
  AUTHORITY_PENDING: {
    APPROVE: 'AUTHORITY_APPROVED',
    DENY: 'CANCELLED',
    ERROR: 'ERROR',
    CANCEL: 'CANCELLED',
    TIMEOUT: 'TIMEOUT',
  },
  AUTHORITY_APPROVED: {
    EXECUTE: 'EXECUTING',
    ERROR: 'ERROR',
    CANCEL: 'CANCELLED',
    TIMEOUT: 'TIMEOUT',
  },
  EXECUTING: {
    EXECUTION_COMPLETE: 'RECEIPT_READY',
    ERROR: 'ERROR',
    CANCEL: 'CANCELLED',
    TIMEOUT: 'TIMEOUT',
  },
  // Terminal states — only RESET is valid
  RECEIPT_READY: {
    RESET: 'IDLE',
  },
  ERROR: {
    RESET: 'IDLE',
  },
  CANCELLED: {
    RESET: 'IDLE',
  },
  TIMEOUT: {
    RESET: 'IDLE',
  },
};

// Step indices for progress bar display (0 = idle, 7 = receipt)
const STEP_INDEX: Record<RunwayState, number> = {
  IDLE: 0,
  PREFLIGHT: 1,
  DRAFT_CREATING: 2,
  DRAFT_READY: 3,
  AUTHORITY_SUBMITTING: 4,
  AUTHORITY_PENDING: 4,
  AUTHORITY_APPROVED: 5,
  EXECUTING: 6,
  RECEIPT_READY: 7,
  ERROR: -1,
  CANCELLED: -1,
  TIMEOUT: -1,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pure transition function. Returns the next state or null if illegal.
 * Emits telemetry on every successful transition.
 */
export function transition(
  currentState: RunwayState,
  event: RunwayEvent,
): RunwayState | null {
  const allowed = TRANSITIONS[currentState];
  const nextState = allowed[event];

  if (nextState === undefined) {
    return null; // Illegal transition — guard
  }

  // Emit telemetry for every successful transition
  emitCanvasEvent('runway_step', {
    from: currentState,
    to: nextState,
    event,
  });

  return nextState;
}

/**
 * Returns true if the state is terminal (RECEIPT_READY, ERROR, CANCELLED, TIMEOUT).
 */
export function isTerminal(state: RunwayState): boolean {
  return TERMINAL_STATES.has(state);
}

/**
 * Returns true if the state is an active (in-flight) state.
 */
export function isActive(state: RunwayState): boolean {
  return ACTIVE_STATES.has(state);
}

/**
 * Returns the list of events valid from the given state.
 */
export function getValidEvents(state: RunwayState): RunwayEvent[] {
  const allowed = TRANSITIONS[state];
  return Object.keys(allowed) as RunwayEvent[];
}

/**
 * Returns the step index (0-7) for progress display.
 * Returns -1 for error/cancelled/timeout states.
 */
export function getStepIndex(state: RunwayState): number {
  return STEP_INDEX[state];
}
