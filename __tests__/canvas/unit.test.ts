// ---------------------------------------------------------------------------
// Canvas Mode — Pure Logic Unit Tests
// Covers: runwayMachine, tileManifest, failureCodes, canvasTelemetry,
//         immersionStore
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

// Mock react-native (Platform.OS = 'web')
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// Mock react hooks used by immersionStore's useImmersion
jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    useState: jest.fn((init: unknown) => {
      const val = typeof init === 'function' ? (init as () => unknown)() : init;
      return [val, jest.fn()];
    }),
    useEffect: jest.fn(),
  };
});

// Mock canvasTelemetry for runwayMachine import (it calls emitCanvasEvent)
jest.mock('@/lib/canvasTelemetry', () => ({
  emitCanvasEvent: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  transition,
  isTerminal,
  isActive,
  getValidEvents,
  getStepIndex,
  type RunwayState,
  type RunwayEvent,
} from '@/lib/runwayMachine';

import {
  getTile,
  getAllTiles,
  getTileVerbs,
  searchVerbs,
  type TileEntry,
  type TileVerb,
} from '@/lib/tileManifest';

import {
  getFailureCode,
  getAllFailureCodes,
  FAILURE_CODES,
  type FailureCode,
  type FailureSeverity,
} from '@/lib/failureCodes';

import { emitCanvasEvent } from '@/lib/canvasTelemetry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_STATES: RunwayState[] = [
  'IDLE',
  'PREFLIGHT',
  'DRAFT_CREATING',
  'DRAFT_READY',
  'AUTHORITY_SUBMITTING',
  'AUTHORITY_PENDING',
  'AUTHORITY_APPROVED',
  'EXECUTING',
  'RECEIPT_READY',
  'ERROR',
  'CANCELLED',
  'TIMEOUT',
];

const ACTIVE_STATE_LIST: RunwayState[] = [
  'PREFLIGHT',
  'DRAFT_CREATING',
  'DRAFT_READY',
  'AUTHORITY_SUBMITTING',
  'AUTHORITY_PENDING',
  'AUTHORITY_APPROVED',
  'EXECUTING',
];

const TERMINAL_STATE_LIST: RunwayState[] = [
  'RECEIPT_READY',
  'ERROR',
  'CANCELLED',
  'TIMEOUT',
];

// ============================================================================
// 1) runwayMachine
// ============================================================================

describe('runwayMachine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Happy path: IDLE -> RECEIPT_READY
  // -----------------------------------------------------------------------
  describe('happy path (full pipeline)', () => {
    it('transitions IDLE through RECEIPT_READY in correct order', () => {
      const steps: Array<{ event: RunwayEvent; expected: RunwayState }> = [
        { event: 'START_INTENT', expected: 'PREFLIGHT' },
        { event: 'PREFLIGHT_OK', expected: 'DRAFT_CREATING' },
        { event: 'DRAFT_COMPLETE', expected: 'DRAFT_READY' },
        { event: 'SUBMIT_AUTHORITY', expected: 'AUTHORITY_SUBMITTING' },
        { event: 'AUTHORITY_RECEIVED', expected: 'AUTHORITY_PENDING' },
        { event: 'APPROVE', expected: 'AUTHORITY_APPROVED' },
        { event: 'EXECUTE', expected: 'EXECUTING' },
        { event: 'EXECUTION_COMPLETE', expected: 'RECEIPT_READY' },
      ];

      let current: RunwayState = 'IDLE';
      for (const step of steps) {
        const next = transition(current, step.event);
        expect(next).toBe(step.expected);
        current = next as RunwayState;
      }
    });

    it('emits telemetry on every successful transition', () => {
      const mockEmit = emitCanvasEvent as jest.Mock;
      transition('IDLE', 'START_INTENT');
      expect(mockEmit).toHaveBeenCalledWith('runway_step', {
        from: 'IDLE',
        to: 'PREFLIGHT',
        event: 'START_INTENT',
      });
    });
  });

  // -----------------------------------------------------------------------
  // ERROR from every active state
  // -----------------------------------------------------------------------
  describe('error transitions', () => {
    it.each(ACTIVE_STATE_LIST)(
      'transitions %s + ERROR -> ERROR',
      (state) => {
        expect(transition(state, 'ERROR')).toBe('ERROR');
      },
    );
  });

  // -----------------------------------------------------------------------
  // CANCEL from every active state
  // -----------------------------------------------------------------------
  describe('cancel transitions', () => {
    it.each(ACTIVE_STATE_LIST)(
      'transitions %s + CANCEL -> CANCELLED',
      (state) => {
        expect(transition(state, 'CANCEL')).toBe('CANCELLED');
      },
    );
  });

  // -----------------------------------------------------------------------
  // TIMEOUT from every active state
  // -----------------------------------------------------------------------
  describe('timeout transitions', () => {
    it.each(ACTIVE_STATE_LIST)(
      'transitions %s + TIMEOUT -> TIMEOUT',
      (state) => {
        expect(transition(state, 'TIMEOUT')).toBe('TIMEOUT');
      },
    );
  });

  // -----------------------------------------------------------------------
  // DENY from AUTHORITY_PENDING
  // -----------------------------------------------------------------------
  describe('deny transition', () => {
    it('transitions AUTHORITY_PENDING + DENY -> CANCELLED', () => {
      expect(transition('AUTHORITY_PENDING', 'DENY')).toBe('CANCELLED');
    });

    it('returns null for DENY from non-AUTHORITY_PENDING states', () => {
      const nonPendingStates = ALL_STATES.filter(
        (s) => s !== 'AUTHORITY_PENDING',
      );
      for (const state of nonPendingStates) {
        expect(transition(state, 'DENY')).toBeNull();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Terminal RESET -> IDLE
  // -----------------------------------------------------------------------
  describe('terminal state reset', () => {
    it.each(TERMINAL_STATE_LIST)(
      'transitions %s + RESET -> IDLE',
      (state) => {
        expect(transition(state, 'RESET')).toBe('IDLE');
      },
    );
  });

  // -----------------------------------------------------------------------
  // Illegal transitions return null
  // -----------------------------------------------------------------------
  describe('illegal transitions', () => {
    it('IDLE + APPROVE returns null', () => {
      expect(transition('IDLE', 'APPROVE')).toBeNull();
    });

    it('IDLE + EXECUTE returns null', () => {
      expect(transition('IDLE', 'EXECUTE')).toBeNull();
    });

    it('RECEIPT_READY + EXECUTE returns null', () => {
      expect(transition('RECEIPT_READY', 'EXECUTE')).toBeNull();
    });

    it('RECEIPT_READY + START_INTENT returns null', () => {
      expect(transition('RECEIPT_READY', 'START_INTENT')).toBeNull();
    });

    it('ERROR + APPROVE returns null', () => {
      expect(transition('ERROR', 'APPROVE')).toBeNull();
    });

    it('CANCELLED + EXECUTE returns null', () => {
      expect(transition('CANCELLED', 'EXECUTE')).toBeNull();
    });

    it('EXECUTING + APPROVE returns null', () => {
      expect(transition('EXECUTING', 'APPROVE')).toBeNull();
    });

    it('IDLE + RESET returns null (IDLE is not terminal)', () => {
      expect(transition('IDLE', 'RESET')).toBeNull();
    });

    it('PREFLIGHT + EXECUTION_COMPLETE returns null (skip ahead)', () => {
      expect(transition('PREFLIGHT', 'EXECUTION_COMPLETE')).toBeNull();
    });

    it('does not emit telemetry on illegal transition', () => {
      const mockEmit = emitCanvasEvent as jest.Mock;
      mockEmit.mockClear();
      transition('IDLE', 'APPROVE');
      expect(mockEmit).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // isTerminal
  // -----------------------------------------------------------------------
  describe('isTerminal', () => {
    it.each(TERMINAL_STATE_LIST)(
      'returns true for terminal state %s',
      (state) => {
        expect(isTerminal(state)).toBe(true);
      },
    );

    it('returns false for IDLE', () => {
      expect(isTerminal('IDLE')).toBe(false);
    });

    it.each(ACTIVE_STATE_LIST)(
      'returns false for active state %s',
      (state) => {
        expect(isTerminal(state)).toBe(false);
      },
    );
  });

  // -----------------------------------------------------------------------
  // isActive
  // -----------------------------------------------------------------------
  describe('isActive', () => {
    it.each(ACTIVE_STATE_LIST)(
      'returns true for active state %s',
      (state) => {
        expect(isActive(state)).toBe(true);
      },
    );

    it('returns false for IDLE', () => {
      expect(isActive('IDLE')).toBe(false);
    });

    it.each(TERMINAL_STATE_LIST)(
      'returns false for terminal state %s',
      (state) => {
        expect(isActive(state)).toBe(false);
      },
    );
  });

  // -----------------------------------------------------------------------
  // getValidEvents
  // -----------------------------------------------------------------------
  describe('getValidEvents', () => {
    it('returns [START_INTENT] for IDLE', () => {
      expect(getValidEvents('IDLE')).toEqual(['START_INTENT']);
    });

    it('returns PREFLIGHT_OK, ERROR, CANCEL, TIMEOUT for PREFLIGHT', () => {
      const events = getValidEvents('PREFLIGHT');
      expect(events).toContain('PREFLIGHT_OK');
      expect(events).toContain('ERROR');
      expect(events).toContain('CANCEL');
      expect(events).toContain('TIMEOUT');
      expect(events).toHaveLength(4);
    });

    it('returns APPROVE, DENY, ERROR, CANCEL, TIMEOUT for AUTHORITY_PENDING', () => {
      const events = getValidEvents('AUTHORITY_PENDING');
      expect(events).toContain('APPROVE');
      expect(events).toContain('DENY');
      expect(events).toContain('ERROR');
      expect(events).toContain('CANCEL');
      expect(events).toContain('TIMEOUT');
      expect(events).toHaveLength(5);
    });

    it('returns [RESET] for each terminal state', () => {
      for (const state of TERMINAL_STATE_LIST) {
        expect(getValidEvents(state)).toEqual(['RESET']);
      }
    });

    it('returns EXECUTION_COMPLETE, ERROR, CANCEL, TIMEOUT for EXECUTING', () => {
      const events = getValidEvents('EXECUTING');
      expect(events).toContain('EXECUTION_COMPLETE');
      expect(events).toContain('ERROR');
      expect(events).toContain('CANCEL');
      expect(events).toContain('TIMEOUT');
      expect(events).toHaveLength(4);
    });
  });

  // -----------------------------------------------------------------------
  // getStepIndex
  // -----------------------------------------------------------------------
  describe('getStepIndex', () => {
    it('returns 0 for IDLE', () => {
      expect(getStepIndex('IDLE')).toBe(0);
    });

    it('returns 1 for PREFLIGHT', () => {
      expect(getStepIndex('PREFLIGHT')).toBe(1);
    });

    it('returns 2 for DRAFT_CREATING', () => {
      expect(getStepIndex('DRAFT_CREATING')).toBe(2);
    });

    it('returns 3 for DRAFT_READY', () => {
      expect(getStepIndex('DRAFT_READY')).toBe(3);
    });

    it('returns 4 for AUTHORITY_SUBMITTING', () => {
      expect(getStepIndex('AUTHORITY_SUBMITTING')).toBe(4);
    });

    it('returns 4 for AUTHORITY_PENDING (same step as SUBMITTING)', () => {
      expect(getStepIndex('AUTHORITY_PENDING')).toBe(4);
    });

    it('returns 5 for AUTHORITY_APPROVED', () => {
      expect(getStepIndex('AUTHORITY_APPROVED')).toBe(5);
    });

    it('returns 6 for EXECUTING', () => {
      expect(getStepIndex('EXECUTING')).toBe(6);
    });

    it('returns 7 for RECEIPT_READY', () => {
      expect(getStepIndex('RECEIPT_READY')).toBe(7);
    });

    it('returns -1 for ERROR', () => {
      expect(getStepIndex('ERROR')).toBe(-1);
    });

    it('returns -1 for CANCELLED', () => {
      expect(getStepIndex('CANCELLED')).toBe(-1);
    });

    it('returns -1 for TIMEOUT', () => {
      expect(getStepIndex('TIMEOUT')).toBe(-1);
    });
  });
});

// ============================================================================
// 2) tileManifest
// ============================================================================

describe('tileManifest', () => {
  // -----------------------------------------------------------------------
  // getTile
  // -----------------------------------------------------------------------
  describe('getTile', () => {
    it('returns valid TileEntry for "invoice"', () => {
      const tile = getTile('invoice');
      expect(tile).not.toBeNull();
      expect(tile!.id).toBe('invoice');
      expect(tile!.desk).toBe('quinn');
      expect(tile!.label).toBe('Invoice');
      expect(tile!.icon).toBe('receipt-outline');
      expect(tile!.verbs).toBeDefined();
      expect(tile!.verbs.length).toBe(3);
      expect(tile!.defaultVerb).toBe('create');
    });

    it('returns null for unknown tile (deny-by-default)', () => {
      expect(getTile('unknown_tile')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(getTile('')).toBeNull();
    });

    it('returns null for SQL injection string', () => {
      expect(getTile("'; DROP TABLE tiles; --")).toBeNull();
    });

    it('returns null for XSS attack string', () => {
      expect(getTile('<script>alert(1)</script>')).toBeNull();
    });

    it('returns each of the 6 known tiles', () => {
      const expectedIds = [
        'invoice',
        'calendar',
        'email',
        'contract',
        'payment',
        'document',
      ];
      for (const id of expectedIds) {
        expect(getTile(id)).not.toBeNull();
      }
    });
  });

  // -----------------------------------------------------------------------
  // getAllTiles
  // -----------------------------------------------------------------------
  describe('getAllTiles', () => {
    it('returns exactly 6 tiles', () => {
      const tiles = getAllTiles();
      expect(tiles).toHaveLength(6);
    });

    it('returns a copy (not the original array)', () => {
      const tiles1 = getAllTiles();
      const tiles2 = getAllTiles();
      expect(tiles1).not.toBe(tiles2);
    });

    it('includes all expected tile IDs', () => {
      const ids = getAllTiles().map((t) => t.id);
      expect(ids).toEqual(
        expect.arrayContaining([
          'invoice',
          'calendar',
          'email',
          'contract',
          'payment',
          'document',
        ]),
      );
    });
  });

  // -----------------------------------------------------------------------
  // getTileVerbs
  // -----------------------------------------------------------------------
  describe('getTileVerbs', () => {
    it('returns 3 verbs for invoice (create, send, void)', () => {
      const verbs = getTileVerbs('invoice');
      expect(verbs).toHaveLength(3);
      const verbIds = verbs.map((v) => v.id);
      expect(verbIds).toEqual(['create', 'send', 'void']);
    });

    it('returns empty array for unknown tile', () => {
      expect(getTileVerbs('unknown')).toEqual([]);
    });

    it('returns empty array for empty string', () => {
      expect(getTileVerbs('')).toEqual([]);
    });

    it('returns a copy (not the original verbs array)', () => {
      const verbs1 = getTileVerbs('invoice');
      const verbs2 = getTileVerbs('invoice');
      expect(verbs1).not.toBe(verbs2);
    });
  });

  // -----------------------------------------------------------------------
  // searchVerbs
  // -----------------------------------------------------------------------
  describe('searchVerbs', () => {
    it('returns results matching "invoice" (tile label match)', () => {
      const results = searchVerbs('invoice');
      expect(results.length).toBeGreaterThan(0);
      // Tile label match returns ALL verbs of that tile
      for (const r of results) {
        expect(r.tile.id).toBe('invoice');
      }
      // Invoice has 3 verbs so tile label match yields all 3
      expect(results).toHaveLength(3);
    });

    it('is case-insensitive', () => {
      const results = searchVerbs('Create');
      expect(results.length).toBeGreaterThan(0);
      // Should find Create Invoice, Create Event, Create Contract, etc.
      const labels = results.map((r) => r.verb.label);
      expect(labels.some((l) => l.includes('Create'))).toBe(true);
    });

    it('returns empty array for empty query', () => {
      expect(searchVerbs('')).toEqual([]);
    });

    it('returns payment verbs when searching "payment"', () => {
      const results = searchVerbs('payment');
      expect(results.length).toBeGreaterThan(0);
      // Tile label "Payment" matches, so all payment verbs are returned
      for (const r of results) {
        expect(r.tile.id).toBe('payment');
      }
    });

    it('returns results for verb label search "Send"', () => {
      const results = searchVerbs('Send');
      expect(results.length).toBeGreaterThan(0);
      const labels = results.map((r) => r.verb.label);
      expect(labels.some((l) => l.toLowerCase().includes('send'))).toBe(true);
    });

    it('returns empty array for nonsense query', () => {
      expect(searchVerbs('zzzzzzzzzzz')).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // defaultVerb validity
  // -----------------------------------------------------------------------
  describe('defaultVerb validation', () => {
    it('every tile has a defaultVerb that exists in its verbs array', () => {
      const tiles = getAllTiles();
      for (const tile of tiles) {
        const verbIds = tile.verbs.map((v) => v.id);
        expect(verbIds).toContain(tile.defaultVerb);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Risk tier validation
  // -----------------------------------------------------------------------
  describe('risk tier validation', () => {
    it('all verbs have a valid riskTier', () => {
      const validTiers = new Set(['green', 'yellow', 'red']);
      const tiles = getAllTiles();
      for (const tile of tiles) {
        for (const verb of tile.verbs) {
          expect(validTiers.has(verb.riskTier)).toBe(true);
        }
      }
    });

    it('invoice.void is RED tier', () => {
      const tile = getTile('invoice')!;
      const voidVerb = tile.verbs.find((v) => v.id === 'void');
      expect(voidVerb).toBeDefined();
      expect(voidVerb!.riskTier).toBe('red');
    });

    it('contract.send_for_signature is RED tier', () => {
      const tile = getTile('contract')!;
      const signVerb = tile.verbs.find((v) => v.id === 'send_for_signature');
      expect(signVerb).toBeDefined();
      expect(signVerb!.riskTier).toBe('red');
    });

    it('payment.send is RED tier', () => {
      const tile = getTile('payment')!;
      const sendVerb = tile.verbs.find((v) => v.id === 'send');
      expect(sendVerb).toBeDefined();
      expect(sendVerb!.riskTier).toBe('red');
    });

    it('calendar.view is GREEN tier', () => {
      const tile = getTile('calendar')!;
      const viewVerb = tile.verbs.find((v) => v.id === 'view');
      expect(viewVerb).toBeDefined();
      expect(viewVerb!.riskTier).toBe('green');
    });

    it('invoice.create is YELLOW tier', () => {
      const tile = getTile('invoice')!;
      const createVerb = tile.verbs.find((v) => v.id === 'create');
      expect(createVerb).toBeDefined();
      expect(createVerb!.riskTier).toBe('yellow');
    });
  });

  // -----------------------------------------------------------------------
  // Lens fields validation
  // -----------------------------------------------------------------------
  describe('lensFields validation', () => {
    it('every verb has at least one lensField', () => {
      const tiles = getAllTiles();
      for (const tile of tiles) {
        for (const verb of tile.verbs) {
          expect(verb.lensFields.length).toBeGreaterThan(0);
        }
      }
    });

    it('all lensFields have valid types', () => {
      const validTypes = new Set([
        'text',
        'currency',
        'date',
        'status',
        'email',
      ]);
      const tiles = getAllTiles();
      for (const tile of tiles) {
        for (const verb of tile.verbs) {
          for (const field of verb.lensFields) {
            expect(validTypes.has(field.type)).toBe(true);
          }
        }
      }
    });
  });
});

// ============================================================================
// 3) failureCodes
// ============================================================================

describe('failureCodes', () => {
  // -----------------------------------------------------------------------
  // getFailureCode
  // -----------------------------------------------------------------------
  describe('getFailureCode', () => {
    it('returns valid FailureCode for F-001', () => {
      const fc = getFailureCode('F-001');
      expect(fc).not.toBeNull();
      expect(fc!.code).toBe('F-001');
      expect(fc!.severity).toBe('error');
      expect(fc!.userMessage).toBeDefined();
      expect(fc!.internalMessage).toBeDefined();
      expect(typeof fc!.retryable).toBe('boolean');
    });

    it('returns null for F-999 (deny-by-default)', () => {
      expect(getFailureCode('F-999')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(getFailureCode('')).toBeNull();
    });

    it('returns null for arbitrary string', () => {
      expect(getFailureCode('not-a-code')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // getAllFailureCodes
  // -----------------------------------------------------------------------
  describe('getAllFailureCodes', () => {
    it('returns exactly 20 entries (F-001 through F-020)', () => {
      expect(getAllFailureCodes()).toHaveLength(20);
    });

    it('every entry has all required fields', () => {
      const codes = getAllFailureCodes();
      for (const fc of codes) {
        expect(typeof fc.code).toBe('string');
        expect(typeof fc.severity).toBe('string');
        expect(typeof fc.userMessage).toBe('string');
        expect(typeof fc.internalMessage).toBe('string');
        expect(typeof fc.retryable).toBe('boolean');
      }
    });

    it('every code matches its key in FAILURE_CODES', () => {
      for (const [key, fc] of Object.entries(FAILURE_CODES)) {
        expect(fc.code).toBe(key);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Severity validation
  // -----------------------------------------------------------------------
  describe('severity validation', () => {
    const validSeverities = new Set<FailureSeverity>([
      'info',
      'warning',
      'error',
      'critical',
    ]);

    it('every code has a valid severity', () => {
      const codes = getAllFailureCodes();
      for (const fc of codes) {
        expect(validSeverities.has(fc.severity)).toBe(true);
      }
    });

    it('F-018 (cross-tenant) is critical severity', () => {
      const fc = getFailureCode('F-018');
      expect(fc!.severity).toBe('critical');
    });

    it('F-019 (PII detected) is critical severity', () => {
      const fc = getFailureCode('F-019');
      expect(fc!.severity).toBe('critical');
    });
  });

  // -----------------------------------------------------------------------
  // Retryable validation
  // -----------------------------------------------------------------------
  describe('retryable validation', () => {
    it('F-005 (governance denied) is not retryable', () => {
      const fc = getFailureCode('F-005');
      expect(fc!.retryable).toBe(false);
    });

    it('F-008 (manifest miss) is not retryable', () => {
      const fc = getFailureCode('F-008');
      expect(fc!.retryable).toBe(false);
    });

    it('F-001 (network error) is retryable', () => {
      const fc = getFailureCode('F-001');
      expect(fc!.retryable).toBe(true);
    });

    it('F-002 (timeout) is retryable', () => {
      const fc = getFailureCode('F-002');
      expect(fc!.retryable).toBe(true);
    });

    it('F-003 (auth expired) is not retryable', () => {
      const fc = getFailureCode('F-003');
      expect(fc!.retryable).toBe(false);
    });

    it('F-007 (token invalid) is not retryable', () => {
      const fc = getFailureCode('F-007');
      expect(fc!.retryable).toBe(false);
    });

    it('F-018 (cross-tenant) is not retryable', () => {
      const fc = getFailureCode('F-018');
      expect(fc!.retryable).toBe(false);
    });

    it('F-019 (PII detected) is not retryable', () => {
      const fc = getFailureCode('F-019');
      expect(fc!.retryable).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // PII safety check — no PII in user-facing or internal messages
  // -----------------------------------------------------------------------
  describe('PII safety', () => {
    const PII_PATTERNS = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // Email
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone
    ];

    it('no failure code has PII patterns in userMessage', () => {
      const codes = getAllFailureCodes();
      for (const fc of codes) {
        for (const pattern of PII_PATTERNS) {
          expect(pattern.test(fc.userMessage)).toBe(false);
        }
      }
    });

    it('no failure code has PII patterns in internalMessage', () => {
      const codes = getAllFailureCodes();
      for (const fc of codes) {
        for (const pattern of PII_PATTERNS) {
          expect(pattern.test(fc.internalMessage)).toBe(false);
        }
      }
    });
  });

  // -----------------------------------------------------------------------
  // Coverage of specific codes
  // -----------------------------------------------------------------------
  describe('specific code details', () => {
    it('F-010 (FPS degradation) is info severity', () => {
      const fc = getFailureCode('F-010');
      expect(fc!.severity).toBe('info');
    });

    it('F-015 (telemetry flush) has empty user message (silent)', () => {
      const fc = getFailureCode('F-015');
      expect(fc!.userMessage).toBe('');
    });

    it('F-020 (unknown) is retryable', () => {
      const fc = getFailureCode('F-020');
      expect(fc!.retryable).toBe(true);
    });

    it('F-013 (runway invalid transition) is not retryable', () => {
      const fc = getFailureCode('F-013');
      expect(fc!.retryable).toBe(false);
    });
  });
});

// ============================================================================
// 4) canvasTelemetry
// ============================================================================

// We need the REAL module for these tests, so we reimport after clearing the mock
describe('canvasTelemetry', () => {
  // Use the real module — unmock it for this describe block
  let realTelemetry: typeof import('@/lib/canvasTelemetry');

  beforeAll(() => {
    // Restore the real module for telemetry tests
    jest.unmock('@/lib/canvasTelemetry');
    // Isolate to get a fresh module instance
    jest.isolateModules(() => {
      realTelemetry = require('@/lib/canvasTelemetry');
    });
  });

  beforeEach(() => {
    // Clear queue and metrics between tests
    realTelemetry.clearTelemetryQueue();
    realTelemetry.resetSessionMetrics();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // emitCanvasEvent + queue
  // -----------------------------------------------------------------------
  describe('emitCanvasEvent + queue', () => {
    it('adds event to the queue', () => {
      realTelemetry.emitCanvasEvent('stage_open', { tileId: 'invoice' });
      const q = realTelemetry.getTelemetryQueue();
      expect(q).toHaveLength(1);
      expect(q[0].event).toBe('stage_open');
    });

    it('payload contains required fields', () => {
      realTelemetry.emitCanvasEvent('lens_open', { tileId: 'calendar' });
      const payload = realTelemetry.getTelemetryQueue()[0];
      expect(payload.event).toBe('lens_open');
      expect(typeof payload.timestamp).toBe('number');
      expect(typeof payload.sessionId).toBe('string');
      expect(payload.sessionId.length).toBeGreaterThan(0);
      expect(typeof payload.cohort).toBe('string');
      expect(payload.data).toEqual({ tileId: 'calendar' });
    });

    it('multiple events accumulate in queue', () => {
      realTelemetry.emitCanvasEvent('stage_open');
      realTelemetry.emitCanvasEvent('lens_open');
      realTelemetry.emitCanvasEvent('stage_close');
      expect(realTelemetry.getTelemetryQueue()).toHaveLength(3);
    });
  });

  // -----------------------------------------------------------------------
  // clearTelemetryQueue
  // -----------------------------------------------------------------------
  describe('clearTelemetryQueue', () => {
    it('empties the queue', () => {
      realTelemetry.emitCanvasEvent('stage_open');
      realTelemetry.emitCanvasEvent('stage_close');
      expect(realTelemetry.getTelemetryQueue().length).toBe(2);

      realTelemetry.clearTelemetryQueue();
      expect(realTelemetry.getTelemetryQueue()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // setCohort
  // -----------------------------------------------------------------------
  describe('setCohort', () => {
    it('changes cohort on subsequent events', () => {
      realTelemetry.emitCanvasEvent('stage_open');
      expect(realTelemetry.getTelemetryQueue()[0].cohort).toBe('control');

      realTelemetry.setCohort('treatment_a');
      realTelemetry.emitCanvasEvent('stage_close');
      const q = realTelemetry.getTelemetryQueue();
      expect(q[1].cohort).toBe('treatment_a');
    });
  });

  // -----------------------------------------------------------------------
  // Session metrics
  // -----------------------------------------------------------------------
  describe('session metrics', () => {
    it('getSessionMetrics returns initial values', () => {
      const m = realTelemetry.getSessionMetrics();
      expect(m.sloViolations).toBe(0);
      expect(m.modeChanges).toBe(0);
      expect(m.stageOpenCount).toBe(0);
      expect(m.avgFps).toBe(60);
    });

    it('stage_open increments stageOpenCount', () => {
      realTelemetry.emitCanvasEvent('stage_open');
      realTelemetry.emitCanvasEvent('stage_open');
      const m = realTelemetry.getSessionMetrics();
      expect(m.stageOpenCount).toBe(2);
    });

    it('slo_violation increments sloViolations', () => {
      realTelemetry.emitCanvasEvent('slo_violation');
      const m = realTelemetry.getSessionMetrics();
      expect(m.sloViolations).toBe(1);
    });

    it('mode_change increments modeChanges', () => {
      realTelemetry.emitCanvasEvent('mode_change', { from: 'off', to: 'canvas' });
      realTelemetry.emitCanvasEvent('mode_change', { from: 'canvas', to: 'depth' });
      const m = realTelemetry.getSessionMetrics();
      expect(m.modeChanges).toBe(2);
    });

    it('increments eventCounts for all event types', () => {
      realTelemetry.emitCanvasEvent('stage_open');
      realTelemetry.emitCanvasEvent('lens_open');
      realTelemetry.emitCanvasEvent('error');
      const m = realTelemetry.getSessionMetrics();
      expect(m.eventCounts.stage_open).toBe(1);
      expect(m.eventCounts.lens_open).toBe(1);
      expect(m.eventCounts.error).toBe(1);
      expect(m.eventCounts.stage_close).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // resetSessionMetrics
  // -----------------------------------------------------------------------
  describe('resetSessionMetrics', () => {
    it('clears all counters', () => {
      realTelemetry.emitCanvasEvent('stage_open');
      realTelemetry.emitCanvasEvent('slo_violation');
      realTelemetry.emitCanvasEvent('mode_change');
      realTelemetry.recordFpsSample(45);

      realTelemetry.resetSessionMetrics();
      const m = realTelemetry.getSessionMetrics();
      expect(m.sloViolations).toBe(0);
      expect(m.modeChanges).toBe(0);
      expect(m.stageOpenCount).toBe(0);
      expect(m.avgFps).toBe(60); // back to default
    });
  });

  // -----------------------------------------------------------------------
  // recordFpsSample
  // -----------------------------------------------------------------------
  describe('recordFpsSample', () => {
    it('updates avgFps from recorded samples', () => {
      realTelemetry.recordFpsSample(30);
      realTelemetry.recordFpsSample(50);
      const m = realTelemetry.getSessionMetrics();
      // avg of 30 + 50 = 40
      expect(m.avgFps).toBe(40);
    });

    it('single sample yields that value as average', () => {
      realTelemetry.recordFpsSample(55);
      const m = realTelemetry.getSessionMetrics();
      expect(m.avgFps).toBe(55);
    });

    it('rounds to nearest integer', () => {
      realTelemetry.recordFpsSample(30);
      realTelemetry.recordFpsSample(31);
      // avg = 30.5, rounds to 31
      const m = realTelemetry.getSessionMetrics();
      expect(m.avgFps).toBe(31);
    });
  });
});

// ============================================================================
// 5) immersionStore
// ============================================================================

describe('immersionStore', () => {
  // We need the real module — isolate it for fresh state each test
  let store: typeof import('@/lib/immersionStore');

  beforeEach(() => {
    // Get a fresh copy of the store with reset module-level state
    jest.isolateModules(() => {
      store = require('@/lib/immersionStore');
    });
  });

  // -----------------------------------------------------------------------
  // Default state
  // -----------------------------------------------------------------------
  describe('default state', () => {
    it('has mode "off"', () => {
      expect(store.getImmersionState().mode).toBe('off');
    });

    it('has fpsMovingAvg 60', () => {
      expect(store.getImmersionState().fpsMovingAvg).toBe(60);
    });

    it('has stageOpen false', () => {
      expect(store.getImmersionState().stageOpen).toBe(false);
    });

    it('has stagedTileId null', () => {
      expect(store.getImmersionState().stagedTileId).toBeNull();
    });

    it('has runwayState IDLE', () => {
      expect(store.getImmersionState().runwayState).toBe('IDLE');
    });

    it('has dryRunActive false', () => {
      expect(store.getImmersionState().dryRunActive).toBe(false);
    });

    it('has soundMode "essential"', () => {
      expect(store.getImmersionState().soundMode).toBe('essential');
    });

    it('has lensOpen false', () => {
      expect(store.getImmersionState().lensOpen).toBe(false);
    });

    it('has lensTileId null', () => {
      expect(store.getImmersionState().lensTileId).toBeNull();
    });

    it('has commandPaletteOpen false', () => {
      expect(store.getImmersionState().commandPaletteOpen).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // setImmersionMode
  // -----------------------------------------------------------------------
  describe('setImmersionMode', () => {
    it('changes mode to canvas', () => {
      store.setImmersionMode('canvas');
      expect(store.getImmersionState().mode).toBe('canvas');
    });

    it('changes mode to depth', () => {
      store.setImmersionMode('depth');
      expect(store.getImmersionState().mode).toBe('depth');
    });

    it('changes mode back to off', () => {
      store.setImmersionMode('canvas');
      store.setImmersionMode('off');
      expect(store.getImmersionState().mode).toBe('off');
    });
  });

  // -----------------------------------------------------------------------
  // setStageOpen
  // -----------------------------------------------------------------------
  describe('setStageOpen', () => {
    it('opens stage with tileId', () => {
      store.setStageOpen(true, 'invoice');
      const s = store.getImmersionState();
      expect(s.stageOpen).toBe(true);
      expect(s.stagedTileId).toBe('invoice');
    });

    it('closes stage and clears tileId', () => {
      store.setStageOpen(true, 'invoice');
      store.setStageOpen(false);
      const s = store.getImmersionState();
      expect(s.stageOpen).toBe(false);
      expect(s.stagedTileId).toBeNull();
    });

    it('preserves existing tileId when opening without specifying new one', () => {
      store.setStageOpen(true, 'invoice');
      store.setStageOpen(true); // no tileId — keeps existing
      expect(store.getImmersionState().stagedTileId).toBe('invoice');
    });
  });

  // -----------------------------------------------------------------------
  // setRunwayState
  // -----------------------------------------------------------------------
  describe('setRunwayState', () => {
    it('changes runway state', () => {
      store.setRunwayState('PREFLIGHT');
      expect(store.getImmersionState().runwayState).toBe('PREFLIGHT');
    });

    it('progresses through multiple states', () => {
      store.setRunwayState('PREFLIGHT');
      store.setRunwayState('DRAFT_CREATING');
      store.setRunwayState('EXECUTING');
      expect(store.getImmersionState().runwayState).toBe('EXECUTING');
    });
  });

  // -----------------------------------------------------------------------
  // setLensOpen
  // -----------------------------------------------------------------------
  describe('setLensOpen', () => {
    it('opens lens with tileId', () => {
      store.setLensOpen(true, 'calendar');
      const s = store.getImmersionState();
      expect(s.lensOpen).toBe(true);
      expect(s.lensTileId).toBe('calendar');
    });

    it('closes lens and clears tileId', () => {
      store.setLensOpen(true, 'calendar');
      store.setLensOpen(false);
      const s = store.getImmersionState();
      expect(s.lensOpen).toBe(false);
      expect(s.lensTileId).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // setDryRunActive
  // -----------------------------------------------------------------------
  describe('setDryRunActive', () => {
    it('toggles dryRunActive on', () => {
      store.setDryRunActive(true);
      expect(store.getImmersionState().dryRunActive).toBe(true);
    });

    it('toggles dryRunActive off', () => {
      store.setDryRunActive(true);
      store.setDryRunActive(false);
      expect(store.getImmersionState().dryRunActive).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // setSoundMode
  // -----------------------------------------------------------------------
  describe('setSoundMode', () => {
    it('changes sound mode to full', () => {
      store.setSoundMode('full');
      expect(store.getImmersionState().soundMode).toBe('full');
    });

    it('changes sound mode to off', () => {
      store.setSoundMode('off');
      expect(store.getImmersionState().soundMode).toBe('off');
    });

    it('changes sound mode back to essential', () => {
      store.setSoundMode('off');
      store.setSoundMode('essential');
      expect(store.getImmersionState().soundMode).toBe('essential');
    });
  });

  // -----------------------------------------------------------------------
  // setCommandPaletteOpen
  // -----------------------------------------------------------------------
  describe('setCommandPaletteOpen', () => {
    it('opens command palette', () => {
      store.setCommandPaletteOpen(true);
      expect(store.getImmersionState().commandPaletteOpen).toBe(true);
    });

    it('closes command palette', () => {
      store.setCommandPaletteOpen(true);
      store.setCommandPaletteOpen(false);
      expect(store.getImmersionState().commandPaletteOpen).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // setFpsMovingAvg
  // -----------------------------------------------------------------------
  describe('setFpsMovingAvg', () => {
    it('updates fps value', () => {
      store.setFpsMovingAvg(45);
      expect(store.getImmersionState().fpsMovingAvg).toBe(45);
    });

    it('accepts 0 fps', () => {
      store.setFpsMovingAvg(0);
      expect(store.getImmersionState().fpsMovingAvg).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // initImmersionScope
  // -----------------------------------------------------------------------
  describe('initImmersionScope', () => {
    it('resets state to defaults when scope changes', () => {
      store.setImmersionMode('canvas');
      store.setStageOpen(true, 'invoice');
      store.initImmersionScope('suite-123', 'office-1');
      const s = store.getImmersionState();
      // Should reset to defaults (no persisted data in test env)
      expect(s.stageOpen).toBe(false);
      expect(s.stagedTileId).toBeNull();
      expect(s.runwayState).toBe('IDLE');
    });
  });
});
