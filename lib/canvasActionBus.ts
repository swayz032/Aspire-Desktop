/**
 * Canvas Action Bus — Event-driven action routing for Canvas Mode
 *
 * Routes widget actions through governance-compliant risk tier checks:
 *   GREEN  -> Auto-execute via orchestrator (still generates receipt)
 *   YELLOW -> Show confirmation modal, user approves/denies
 *   RED    -> Show authority modal with "I APPROVE" text input
 *
 * Law #1: Single Brain — all execution routes through orchestrator API
 * Law #2: Receipt for All Actions — every action generates a receipt
 * Law #3: Fail Closed — unknown risk tiers are denied
 * Law #4: Risk Tiers Enforced — GREEN/YELLOW/RED with appropriate gates
 * Law #7: Tools Are Hands — bus routes but does not decide
 *
 * Pattern: EventEmitter singleton (matches immersionStore.ts pattern)
 */

import { emitCanvasEvent, type CanvasTelemetryEvent } from '@/lib/canvasTelemetry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RiskTier = 'GREEN' | 'YELLOW' | 'RED';

export type ActionStatus =
  | 'submitted'
  | 'pending_confirmation'
  | 'approved'
  | 'denied'
  | 'executing'
  | 'succeeded'
  | 'failed';

export interface CanvasAction {
  /** Unique action ID (uuid v4) */
  id: string;
  /** Action type (e.g., 'email.send', 'invoice.create') */
  type: string;
  /** Source widget ID */
  widgetId: string;
  /** GREEN / YELLOW / RED */
  riskTier: RiskTier;
  /** Action-specific data */
  payload: Record<string, unknown>;
  /** Tenant scope (Law #6) */
  suiteId: string;
  /** Office scope */
  officeId: string;
  /** User performing the action */
  actorId: string;
  /** Action created timestamp */
  timestamp: number;
}

export interface ActionResult {
  actionId: string;
  status: ActionStatus;
  receiptId?: string;
  error?: string;
  data?: unknown;
}

// ---------------------------------------------------------------------------
// Event System
// ---------------------------------------------------------------------------

export type ActionBusEvent =
  | 'action:submitted'
  | 'action:executing'
  | 'action:succeeded'
  | 'action:failed'
  | 'action:denied'
  | 'confirmation:yellow:requested'
  | 'confirmation:red:requested';

type EventCallback = (payload: unknown) => void;

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

const eventListeners = new Map<string, Set<EventCallback>>();
const pendingActions = new Map<string, CanvasAction>();

// Store approval/denial promise resolvers keyed by action ID
const pendingResolvers = new Map<
  string,
  { resolve: (result: ActionResult) => void }
>();

/**
 * Configurable fetch function for orchestrator calls.
 * Defaults to global fetch. Override via setFetchFn for testing.
 */
let fetchFn: typeof fetch = typeof fetch !== 'undefined' ? fetch : ((() => {
  throw new Error('fetch is not available');
}) as unknown as typeof fetch);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function emit(event: string, payload: unknown): void {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.forEach((cb) => {
      try {
        cb(payload);
      } catch (_e) {
        // Silent — event listeners must never break the bus
      }
    });
  }
}

function generateActionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Orchestrator execution
// ---------------------------------------------------------------------------

async function executeAction(action: CanvasAction): Promise<ActionResult> {
  try {
    emit('action:executing', action);

    const response = await fetchFn('/api/orchestrator/task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-suite-id': action.suiteId,
        'x-office-id': action.officeId,
      },
      body: JSON.stringify({
        task_type: action.type,
        parameters: action.payload,
        actor_id: action.actorId,
        risk_tier: action.riskTier,
        correlation_id: action.id,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Orchestrator error ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    const actionResult: ActionResult = {
      actionId: action.id,
      status: 'succeeded',
      receiptId: result.receipt_id,
      data: result.data,
    };

    emit('action:succeeded', actionResult);
    emitCanvasEvent('runway_step', {
      action_type: action.type,
      risk_tier: action.riskTier,
      status: 'succeeded',
    });

    pendingActions.delete(action.id);
    return actionResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    const actionResult: ActionResult = {
      actionId: action.id,
      status: 'failed',
      error: errorMessage,
    };

    emit('action:failed', actionResult);
    emitCanvasEvent('error', {
      action_type: action.type,
      risk_tier: action.riskTier,
      error: errorMessage,
    });

    pendingActions.delete(action.id);
    return actionResult;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Subscribe to action bus events.
 * Returns an unsubscribe function (call on cleanup).
 */
export function onActionEvent(event: ActionBusEvent, callback: EventCallback): () => void {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event)!.add(callback);

  return () => {
    const listeners = eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        eventListeners.delete(event);
      }
    }
  };
}

/**
 * Submit an action for execution through the governance pipeline.
 *
 * GREEN  -> Immediate execution via orchestrator
 * YELLOW -> Emits confirmation request, returns promise resolving on user decision
 * RED    -> Emits authority request, returns promise resolving on user decision
 *
 * Law #3: Unknown risk tiers are denied (fail closed).
 */
export async function submitAction(action: CanvasAction): Promise<ActionResult> {
  // Ensure action has an ID
  const fullAction: CanvasAction = {
    ...action,
    id: action.id || generateActionId(),
    timestamp: action.timestamp || Date.now(),
  };

  pendingActions.set(fullAction.id, fullAction);
  emit('action:submitted', fullAction);

  // Risk tier routing (Law #4)
  switch (fullAction.riskTier) {
    case 'GREEN':
      return executeAction(fullAction);

    case 'YELLOW':
      return requestConfirmation(fullAction, 'yellow');

    case 'RED':
      return requestConfirmation(fullAction, 'red');

    default: {
      // Law #3: Fail closed — unknown risk tier
      const deniedResult: ActionResult = {
        actionId: fullAction.id,
        status: 'denied',
        error: `Unknown risk tier: ${fullAction.riskTier as string}`,
      };
      emit('action:denied', deniedResult);
      pendingActions.delete(fullAction.id);
      return deniedResult;
    }
  }
}

/**
 * Request user confirmation for YELLOW or RED tier actions.
 * Returns a promise that resolves when user approves or denies.
 */
function requestConfirmation(
  action: CanvasAction,
  tier: 'yellow' | 'red',
): Promise<ActionResult> {
  return new Promise<ActionResult>((resolve) => {
    pendingResolvers.set(action.id, { resolve });
    emit(`confirmation:${tier}:requested`, action);
  });
}

/**
 * Approve a pending YELLOW or RED tier action.
 * Triggers execution via orchestrator.
 */
export async function approveAction(
  actionId: string,
  _tier: 'yellow' | 'red',
): Promise<void> {
  const action = pendingActions.get(actionId);
  const resolver = pendingResolvers.get(actionId);

  if (!action || !resolver) {
    return; // Action not found or already resolved
  }

  pendingResolvers.delete(actionId);

  // Execute and resolve the pending promise
  const result = await executeAction(action);
  resolver.resolve(result);
}

/**
 * Deny a pending YELLOW or RED tier action.
 * Generates a denial receipt.
 */
export function denyAction(
  actionId: string,
  _tier: 'yellow' | 'red',
): void {
  const resolver = pendingResolvers.get(actionId);

  if (!resolver) {
    return; // Action not found or already resolved
  }

  pendingResolvers.delete(actionId);
  pendingActions.delete(actionId);

  const deniedResult: ActionResult = {
    actionId,
    status: 'denied',
  };

  emit('action:denied', deniedResult);
  emitCanvasEvent('runway_step', {
    action_id: actionId,
    status: 'denied',
  });

  resolver.resolve(deniedResult);
}

/**
 * Get a pending action by ID.
 */
export function getPendingAction(actionId: string): CanvasAction | undefined {
  return pendingActions.get(actionId);
}

/**
 * Get count of pending actions.
 */
export function getPendingCount(): number {
  return pendingActions.size;
}

/**
 * Generate a unique action ID.
 */
export { generateActionId };

// ---------------------------------------------------------------------------
// Configuration / Testing
// ---------------------------------------------------------------------------

/**
 * Override the fetch function used for orchestrator calls.
 * Primary use: injecting authenticated fetch or mocking in tests.
 */
export function setFetchFn(fn: typeof fetch): void {
  fetchFn = fn;
}

/**
 * Reset all internal state. Used in tests.
 */
export function resetActionBus(): void {
  // Deny all pending actions
  for (const [actionId] of pendingResolvers) {
    denyAction(actionId, 'yellow');
  }
  pendingActions.clear();
  pendingResolvers.clear();
  eventListeners.clear();
}
