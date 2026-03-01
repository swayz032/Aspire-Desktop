/**
 * canvasActionBus.test.ts -- Unit tests for Canvas Action Bus
 *
 * Tests GREEN/YELLOW/RED risk tier routing, approve/deny flows,
 * event emission, orchestrator integration, and fail-closed behavior.
 *
 * 25+ tests covering:
 * - GREEN tier auto-execution
 * - YELLOW tier confirmation flow
 * - RED tier authorization flow
 * - Approve/deny handlers
 * - Event emission
 * - Fail-closed for unknown tiers
 * - Concurrent action handling
 * - Error handling
 * - Reset/cleanup
 */

import {
  submitAction,
  approveAction,
  denyAction,
  onActionEvent,
  getPendingAction,
  getPendingCount,
  generateActionId,
  setFetchFn,
  resetActionBus,
  type CanvasAction,
  type ActionResult,
} from '../canvasActionBus';

// ---------------------------------------------------------------------------
// Mock telemetry (prevents real telemetry calls)
// ---------------------------------------------------------------------------

jest.mock('@/lib/canvasTelemetry', () => ({
  emitCanvasEvent: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createTestAction(overrides: Partial<CanvasAction> = {}): CanvasAction {
  return {
    id: generateActionId(),
    type: 'email.send',
    widgetId: 'email-widget-1',
    riskTier: 'GREEN',
    payload: { to: 'test@example.com', subject: 'Test' },
    suiteId: 'suite-123',
    officeId: 'office-456',
    actorId: 'user-789',
    timestamp: Date.now(),
    ...overrides,
  };
}

function createMockFetch(
  responseData: Record<string, unknown> = {},
  status = 200,
): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(responseData),
    text: jest.fn().mockResolvedValue(JSON.stringify(responseData)),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('canvasActionBus', () => {
  beforeEach(() => {
    resetActionBus();
    // Default mock fetch that succeeds
    setFetchFn(
      createMockFetch({ receipt_id: 'rcp-001', data: { ok: true } }),
    );
  });

  afterEach(() => {
    resetActionBus();
  });

  // -----------------------------------------------------------------------
  // Action ID generation
  // -----------------------------------------------------------------------

  describe('generateActionId', () => {
    it('generates unique IDs', () => {
      const id1 = generateActionId();
      const id2 = generateActionId();
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it('generates string IDs', () => {
      const id = generateActionId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // GREEN tier (auto-execute)
  // -----------------------------------------------------------------------

  describe('GREEN tier', () => {
    it('auto-executes GREEN actions without confirmation', async () => {
      const action = createTestAction({ riskTier: 'GREEN' });
      const result = await submitAction(action);

      expect(result.status).toBe('succeeded');
      expect(result.receiptId).toBe('rcp-001');
      expect(result.actionId).toBe(action.id);
    });

    it('calls orchestrator API with correct headers', async () => {
      const mockFetch = createMockFetch({ receipt_id: 'rcp-002' });
      setFetchFn(mockFetch);

      const action = createTestAction({ riskTier: 'GREEN' });
      await submitAction(action);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/orchestrator/task',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-suite-id': 'suite-123',
            'x-office-id': 'office-456',
          }),
        }),
      );
    });

    it('includes risk tier and correlation_id in body', async () => {
      const mockFetch = createMockFetch({ receipt_id: 'rcp-003' });
      setFetchFn(mockFetch);

      const action = createTestAction({ riskTier: 'GREEN' });
      await submitAction(action);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.risk_tier).toBe('GREEN');
      expect(callBody.correlation_id).toBe(action.id);
      expect(callBody.task_type).toBe('email.send');
      expect(callBody.actor_id).toBe('user-789');
    });

    it('emits action:submitted event', async () => {
      const submittedHandler = jest.fn();
      onActionEvent('action:submitted', submittedHandler);

      const action = createTestAction({ riskTier: 'GREEN' });
      await submitAction(action);

      expect(submittedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ id: action.id }),
      );
    });

    it('emits action:executing event', async () => {
      const executingHandler = jest.fn();
      onActionEvent('action:executing', executingHandler);

      const action = createTestAction({ riskTier: 'GREEN' });
      await submitAction(action);

      expect(executingHandler).toHaveBeenCalledWith(
        expect.objectContaining({ id: action.id }),
      );
    });

    it('emits action:succeeded event on success', async () => {
      const succeededHandler = jest.fn();
      onActionEvent('action:succeeded', succeededHandler);

      const action = createTestAction({ riskTier: 'GREEN' });
      await submitAction(action);

      expect(succeededHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          actionId: action.id,
          receiptId: 'rcp-001',
        }),
      );
    });

    it('removes action from pending after execution', async () => {
      const action = createTestAction({ riskTier: 'GREEN' });
      await submitAction(action);

      expect(getPendingAction(action.id)).toBeUndefined();
      expect(getPendingCount()).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // GREEN tier error handling
  // -----------------------------------------------------------------------

  describe('GREEN tier error handling', () => {
    it('returns failed status on orchestrator error', async () => {
      setFetchFn(createMockFetch({}, 500));

      const action = createTestAction({ riskTier: 'GREEN' });
      const result = await submitAction(action);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Orchestrator error');
    });

    it('emits action:failed event on error', async () => {
      setFetchFn(createMockFetch({}, 503));
      const failedHandler = jest.fn();
      onActionEvent('action:failed', failedHandler);

      const action = createTestAction({ riskTier: 'GREEN' });
      await submitAction(action);

      expect(failedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ actionId: action.id }),
      );
    });

    it('handles network errors gracefully', async () => {
      setFetchFn(jest.fn().mockRejectedValue(new Error('Network failure')));

      const action = createTestAction({ riskTier: 'GREEN' });
      const result = await submitAction(action);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Network failure');
    });
  });

  // -----------------------------------------------------------------------
  // YELLOW tier (confirmation flow)
  // -----------------------------------------------------------------------

  describe('YELLOW tier', () => {
    it('emits confirmation request for YELLOW actions', () => {
      const requestHandler = jest.fn();
      onActionEvent('confirmation:yellow:requested', requestHandler);

      const action = createTestAction({ riskTier: 'YELLOW' });
      // Don't await -- it resolves when user approves/denies
      submitAction(action);

      expect(requestHandler).toHaveBeenCalledWith(
        expect.objectContaining({ id: action.id, riskTier: 'YELLOW' }),
      );
    });

    it('keeps action pending until approved', () => {
      const action = createTestAction({ riskTier: 'YELLOW' });
      submitAction(action);

      expect(getPendingAction(action.id)).toBeDefined();
      expect(getPendingCount()).toBe(1);
    });

    it('executes action when approved', async () => {
      const action = createTestAction({ riskTier: 'YELLOW' });
      const resultPromise = submitAction(action);

      // Approve the action
      await approveAction(action.id, 'yellow');
      const result = await resultPromise;

      expect(result.status).toBe('succeeded');
      expect(result.receiptId).toBe('rcp-001');
    });

    it('denies action when cancelled', async () => {
      const action = createTestAction({ riskTier: 'YELLOW' });
      const resultPromise = submitAction(action);

      // Deny the action
      denyAction(action.id, 'yellow');
      const result = await resultPromise;

      expect(result.status).toBe('denied');
    });

    it('emits action:denied event when denied', async () => {
      const deniedHandler = jest.fn();
      onActionEvent('action:denied', deniedHandler);

      const action = createTestAction({ riskTier: 'YELLOW' });
      submitAction(action);

      denyAction(action.id, 'yellow');

      expect(deniedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ actionId: action.id, status: 'denied' }),
      );
    });

    it('removes pending action after denial', async () => {
      const action = createTestAction({ riskTier: 'YELLOW' });
      submitAction(action);

      denyAction(action.id, 'yellow');

      expect(getPendingAction(action.id)).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // RED tier (authority flow)
  // -----------------------------------------------------------------------

  describe('RED tier', () => {
    it('emits authority request for RED actions', () => {
      const requestHandler = jest.fn();
      onActionEvent('confirmation:red:requested', requestHandler);

      const action = createTestAction({
        riskTier: 'RED',
        type: 'payment.send',
      });
      submitAction(action);

      expect(requestHandler).toHaveBeenCalledWith(
        expect.objectContaining({ id: action.id, riskTier: 'RED' }),
      );
    });

    it('keeps action pending until authorized', () => {
      const action = createTestAction({ riskTier: 'RED' });
      submitAction(action);

      expect(getPendingAction(action.id)).toBeDefined();
    });

    it('executes action when authorized', async () => {
      const action = createTestAction({ riskTier: 'RED' });
      const resultPromise = submitAction(action);

      await approveAction(action.id, 'red');
      const result = await resultPromise;

      expect(result.status).toBe('succeeded');
    });

    it('denies action when rejected', async () => {
      const action = createTestAction({ riskTier: 'RED' });
      const resultPromise = submitAction(action);

      denyAction(action.id, 'red');
      const result = await resultPromise;

      expect(result.status).toBe('denied');
    });
  });

  // -----------------------------------------------------------------------
  // Fail-closed behavior (Law #3)
  // -----------------------------------------------------------------------

  describe('fail-closed behavior', () => {
    it('denies actions with unknown risk tier', async () => {
      const action = createTestAction({
        riskTier: 'UNKNOWN' as 'GREEN',
      });
      const result = await submitAction(action);

      expect(result.status).toBe('denied');
      expect(result.error).toContain('Unknown risk tier');
    });

    it('emits action:denied for unknown risk tier', async () => {
      const deniedHandler = jest.fn();
      onActionEvent('action:denied', deniedHandler);

      const action = createTestAction({
        riskTier: 'INVALID' as 'GREEN',
      });
      await submitAction(action);

      expect(deniedHandler).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Event system
  // -----------------------------------------------------------------------

  describe('event system', () => {
    it('supports multiple listeners for same event', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      onActionEvent('action:submitted', handler1);
      onActionEvent('action:submitted', handler2);

      const action = createTestAction({ riskTier: 'GREEN' });
      await submitAction(action);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('unsubscribe function removes listener', async () => {
      const handler = jest.fn();
      const unsubscribe = onActionEvent('action:submitted', handler);
      unsubscribe();

      const action = createTestAction({ riskTier: 'GREEN' });
      await submitAction(action);

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not crash when listener throws', async () => {
      onActionEvent('action:submitted', () => {
        throw new Error('Listener error');
      });

      const action = createTestAction({ riskTier: 'GREEN' });
      // Should not throw
      const result = await submitAction(action);
      expect(result.status).toBe('succeeded');
    });
  });

  // -----------------------------------------------------------------------
  // Concurrent actions
  // -----------------------------------------------------------------------

  describe('concurrent actions', () => {
    it('handles multiple pending YELLOW actions', () => {
      const action1 = createTestAction({
        riskTier: 'YELLOW',
        type: 'email.send',
      });
      const action2 = createTestAction({
        riskTier: 'YELLOW',
        type: 'invoice.create',
      });

      submitAction(action1);
      submitAction(action2);

      expect(getPendingCount()).toBe(2);
      expect(getPendingAction(action1.id)).toBeDefined();
      expect(getPendingAction(action2.id)).toBeDefined();
    });

    it('approve one without affecting others', async () => {
      const action1 = createTestAction({ riskTier: 'YELLOW' });
      const action2 = createTestAction({ riskTier: 'YELLOW' });

      const result1Promise = submitAction(action1);
      submitAction(action2);

      await approveAction(action1.id, 'yellow');
      const result1 = await result1Promise;

      expect(result1.status).toBe('succeeded');
      // action2 should still be pending
      expect(getPendingAction(action2.id)).toBeDefined();

      // Clean up
      denyAction(action2.id, 'yellow');
    });
  });

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  describe('resetActionBus', () => {
    it('clears all pending actions', () => {
      const action = createTestAction({ riskTier: 'YELLOW' });
      submitAction(action);

      expect(getPendingCount()).toBe(1);

      resetActionBus();

      expect(getPendingCount()).toBe(0);
    });

    it('clears all event listeners', async () => {
      const handler = jest.fn();
      onActionEvent('action:submitted', handler);

      resetActionBus();

      const action = createTestAction({ riskTier: 'GREEN' });
      await submitAction(action);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('approve non-existent action is a no-op', async () => {
      // Should not throw
      await approveAction('non-existent-id', 'yellow');
    });

    it('deny non-existent action is a no-op', () => {
      // Should not throw
      denyAction('non-existent-id', 'red');
    });

    it('generates ID if not provided', async () => {
      const action = createTestAction({ riskTier: 'GREEN', id: '' });
      const result = await submitAction(action);

      expect(result.actionId).toBeTruthy();
    });

    it('generates timestamp if not provided', async () => {
      const action = createTestAction({ riskTier: 'GREEN', timestamp: 0 });
      const result = await submitAction(action);

      expect(result.status).toBe('succeeded');
    });
  });
});
