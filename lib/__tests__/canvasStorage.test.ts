/**
 * canvasStorage.test.ts -- Unit tests for Canvas State Persistence (Wave 18)
 *
 * Tests cover:
 * - Save/load/clear with tenant scoping
 * - Schema validation (reject corrupt/invalid data)
 * - Debounced save timing
 * - Safety limits (MAX_WIDGETS, MAX_AVATARS)
 * - Edge cases (empty strings, missing fields, wrong version)
 */

import {
  saveCanvasState,
  loadCanvasState,
  clearCanvasState,
  debouncedSaveCanvasState,
  cancelPendingSave,
  flushPendingSave,
  getStorageKey,
  SCHEMA_VERSION,
  MAX_WIDGETS,
  MAX_AVATARS,
  type CanvasState,
  type WidgetState,
  type AvatarState,
} from '../canvasStorage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// Mock localStorage
const mockStorage: Record<string, string> = {};

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn((key: string) => mockStorage[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStorage[key];
    }),
    clear: jest.fn(() => {
      Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    }),
  },
  writable: true,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createValidState(overrides?: Partial<CanvasState>): CanvasState {
  return {
    version: SCHEMA_VERSION,
    widgets: [
      {
        id: 'w1',
        type: 'email',
        x: 100,
        y: 200,
        width: 400,
        height: 300,
        zIndex: 1,
      },
    ],
    avatars: [
      { agent: 'ava', x: 50, y: 50 },
    ],
    lastModified: Date.now(),
    ...overrides,
  };
}

function createWidget(id: string, overrides?: Partial<WidgetState>): WidgetState {
  return {
    id,
    type: 'email',
    x: 0,
    y: 0,
    width: 300,
    height: 200,
    zIndex: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers();
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  jest.clearAllMocks();
  cancelPendingSave();
});

afterEach(() => {
  jest.useRealTimers();
  cancelPendingSave();
});

// ---------------------------------------------------------------------------
// Tests: Storage Key Generation
// ---------------------------------------------------------------------------

describe('getStorageKey', () => {
  it('generates tenant-scoped key', () => {
    const key = getStorageKey('suite-abc', 'office-123');
    expect(key).toBe('aspire_canvas_state_suite-abc_office-123');
  });

  it('produces unique keys for different tenants', () => {
    const key1 = getStorageKey('suite-1', 'office-1');
    const key2 = getStorageKey('suite-2', 'office-1');
    const key3 = getStorageKey('suite-1', 'office-2');
    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key2).not.toBe(key3);
  });
});

// ---------------------------------------------------------------------------
// Tests: Save
// ---------------------------------------------------------------------------

describe('saveCanvasState', () => {
  it('saves valid state to localStorage', () => {
    const state = createValidState();
    saveCanvasState('suite-1', 'office-1', state);

    expect(localStorage.setItem).toHaveBeenCalledTimes(1);
    const key = getStorageKey('suite-1', 'office-1');
    expect(localStorage.setItem).toHaveBeenCalledWith(key, expect.any(String));

    const saved = JSON.parse(mockStorage[key]);
    expect(saved.version).toBe(SCHEMA_VERSION);
    expect(saved.widgets).toHaveLength(1);
    expect(saved.widgets[0].id).toBe('w1');
    expect(saved.avatars).toHaveLength(1);
    expect(saved.avatars[0].agent).toBe('ava');
  });

  it('no-ops when suiteId is empty', () => {
    saveCanvasState('', 'office-1', createValidState());
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('no-ops when officeId is empty', () => {
    saveCanvasState('suite-1', '', createValidState());
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('enforces MAX_WIDGETS limit', () => {
    const widgets = Array.from({ length: MAX_WIDGETS + 10 }, (_, i) =>
      createWidget(`w-${i}`),
    );
    const state = createValidState({ widgets });
    saveCanvasState('suite-1', 'office-1', state);

    const key = getStorageKey('suite-1', 'office-1');
    const saved = JSON.parse(mockStorage[key]);
    expect(saved.widgets).toHaveLength(MAX_WIDGETS);
  });

  it('enforces MAX_AVATARS limit', () => {
    const avatars: AvatarState[] = Array.from({ length: MAX_AVATARS + 5 }, () => ({
      agent: 'ava' as const,
      x: 0,
      y: 0,
    }));
    const state = createValidState({ avatars });
    saveCanvasState('suite-1', 'office-1', state);

    const key = getStorageKey('suite-1', 'office-1');
    const saved = JSON.parse(mockStorage[key]);
    expect(saved.avatars).toHaveLength(MAX_AVATARS);
  });

  it('sets lastModified to current timestamp', () => {
    const now = 1700000000000;
    jest.setSystemTime(now);

    saveCanvasState('suite-1', 'office-1', createValidState());

    const key = getStorageKey('suite-1', 'office-1');
    const saved = JSON.parse(mockStorage[key]);
    expect(saved.lastModified).toBe(now);
  });

  it('silently handles localStorage errors', () => {
    (localStorage.setItem as jest.Mock).mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });

    // Should not throw
    expect(() => {
      saveCanvasState('suite-1', 'office-1', createValidState());
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests: Load
// ---------------------------------------------------------------------------

describe('loadCanvasState', () => {
  it('loads previously saved state', () => {
    const state = createValidState();
    saveCanvasState('suite-1', 'office-1', state);

    const loaded = loadCanvasState('suite-1', 'office-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.widgets).toHaveLength(1);
    expect(loaded!.widgets[0].id).toBe('w1');
    expect(loaded!.avatars).toHaveLength(1);
    expect(loaded!.avatars[0].agent).toBe('ava');
  });

  it('returns null when no saved state exists', () => {
    const result = loadCanvasState('suite-1', 'office-nonexistent');
    expect(result).toBeNull();
  });

  it('returns null when suiteId is empty', () => {
    const result = loadCanvasState('', 'office-1');
    expect(result).toBeNull();
  });

  it('returns null when officeId is empty', () => {
    const result = loadCanvasState('suite-1', '');
    expect(result).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    const key = getStorageKey('suite-1', 'office-1');
    mockStorage[key] = 'not valid json {{{';

    const result = loadCanvasState('suite-1', 'office-1');
    expect(result).toBeNull();
  });

  it('returns null for wrong schema version', () => {
    const key = getStorageKey('suite-1', 'office-1');
    mockStorage[key] = JSON.stringify({
      version: 999,
      widgets: [],
      avatars: [],
      lastModified: Date.now(),
    });

    const result = loadCanvasState('suite-1', 'office-1');
    expect(result).toBeNull();
  });

  it('filters out invalid widgets', () => {
    const key = getStorageKey('suite-1', 'office-1');
    mockStorage[key] = JSON.stringify({
      version: SCHEMA_VERSION,
      widgets: [
        { id: 'valid', type: 'email', x: 0, y: 0, width: 300, height: 200, zIndex: 1 },
        { id: 'invalid-missing-type', x: 0, y: 0, width: 300, height: 200, zIndex: 1 },
        { id: 'invalid-nan', type: 'email', x: NaN, y: 0, width: 300, height: 200, zIndex: 1 },
        null,
        42,
        'string',
      ],
      avatars: [],
      lastModified: Date.now(),
    });

    const result = loadCanvasState('suite-1', 'office-1');
    expect(result).not.toBeNull();
    expect(result!.widgets).toHaveLength(1);
    expect(result!.widgets[0].id).toBe('valid');
  });

  it('filters out invalid avatars', () => {
    const key = getStorageKey('suite-1', 'office-1');
    mockStorage[key] = JSON.stringify({
      version: SCHEMA_VERSION,
      widgets: [],
      avatars: [
        { agent: 'ava', x: 50, y: 50 },
        { agent: 'invalid_agent', x: 0, y: 0 },
        { agent: 'finn', x: Infinity, y: 0 },
        null,
      ],
      lastModified: Date.now(),
    });

    const result = loadCanvasState('suite-1', 'office-1');
    expect(result).not.toBeNull();
    expect(result!.avatars).toHaveLength(1);
    expect(result!.avatars[0].agent).toBe('ava');
  });

  it('returns null when widgets field is not an array', () => {
    const key = getStorageKey('suite-1', 'office-1');
    mockStorage[key] = JSON.stringify({
      version: SCHEMA_VERSION,
      widgets: 'not an array',
      avatars: [],
      lastModified: Date.now(),
    });

    const result = loadCanvasState('suite-1', 'office-1');
    expect(result).toBeNull();
  });

  it('handles missing avatars field gracefully', () => {
    const key = getStorageKey('suite-1', 'office-1');
    mockStorage[key] = JSON.stringify({
      version: SCHEMA_VERSION,
      widgets: [
        { id: 'w1', type: 'email', x: 0, y: 0, width: 300, height: 200, zIndex: 1 },
      ],
      lastModified: Date.now(),
      // avatars field missing
    });

    const result = loadCanvasState('suite-1', 'office-1');
    expect(result).not.toBeNull();
    expect(result!.avatars).toHaveLength(0);
  });

  it('silently handles localStorage errors', () => {
    (localStorage.getItem as jest.Mock).mockImplementationOnce(() => {
      throw new Error('SecurityError');
    });

    const result = loadCanvasState('suite-1', 'office-1');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: Clear
// ---------------------------------------------------------------------------

describe('clearCanvasState', () => {
  it('removes saved state from localStorage', () => {
    saveCanvasState('suite-1', 'office-1', createValidState());
    expect(loadCanvasState('suite-1', 'office-1')).not.toBeNull();

    clearCanvasState('suite-1', 'office-1');
    expect(loadCanvasState('suite-1', 'office-1')).toBeNull();
  });

  it('no-ops when suiteId is empty', () => {
    clearCanvasState('', 'office-1');
    expect(localStorage.removeItem).not.toHaveBeenCalled();
  });

  it('does not affect other tenants', () => {
    saveCanvasState('suite-1', 'office-1', createValidState());
    saveCanvasState('suite-2', 'office-1', createValidState());

    clearCanvasState('suite-1', 'office-1');

    expect(loadCanvasState('suite-1', 'office-1')).toBeNull();
    expect(loadCanvasState('suite-2', 'office-1')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: Debounced Save
// ---------------------------------------------------------------------------

describe('debouncedSaveCanvasState', () => {
  it('saves after delay expires', () => {
    const state = createValidState();
    debouncedSaveCanvasState('suite-1', 'office-1', state, 500);

    // Not saved yet
    expect(localStorage.setItem).not.toHaveBeenCalled();

    // Advance past debounce
    jest.advanceTimersByTime(500);

    expect(localStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it('coalesces rapid calls (only last call persists)', () => {
    const state1 = createValidState({ widgets: [createWidget('w1', { x: 10 })] });
    const state2 = createValidState({ widgets: [createWidget('w1', { x: 20 })] });
    const state3 = createValidState({ widgets: [createWidget('w1', { x: 30 })] });

    debouncedSaveCanvasState('suite-1', 'office-1', state1, 500);
    jest.advanceTimersByTime(100);
    debouncedSaveCanvasState('suite-1', 'office-1', state2, 500);
    jest.advanceTimersByTime(100);
    debouncedSaveCanvasState('suite-1', 'office-1', state3, 500);

    // Advance past final debounce
    jest.advanceTimersByTime(500);

    // Only one save call (the last one)
    expect(localStorage.setItem).toHaveBeenCalledTimes(1);
    const key = getStorageKey('suite-1', 'office-1');
    const saved = JSON.parse(mockStorage[key]);
    expect(saved.widgets[0].x).toBe(30);
  });

  it('respects custom delay', () => {
    debouncedSaveCanvasState('suite-1', 'office-1', createValidState(), 1000);

    jest.advanceTimersByTime(500);
    expect(localStorage.setItem).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    expect(localStorage.setItem).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: Cancel / Flush
// ---------------------------------------------------------------------------

describe('cancelPendingSave', () => {
  it('prevents a pending debounced save', () => {
    debouncedSaveCanvasState('suite-1', 'office-1', createValidState(), 500);

    cancelPendingSave();
    jest.advanceTimersByTime(1000);

    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
});

describe('flushPendingSave', () => {
  it('saves immediately and cancels pending timer', () => {
    const state = createValidState();

    // Start a debounced save
    debouncedSaveCanvasState('suite-1', 'office-1', state, 500);

    // Flush immediately
    flushPendingSave('suite-1', 'office-1', state);

    // Should have saved once (from flush)
    expect(localStorage.setItem).toHaveBeenCalledTimes(1);

    // Advancing time should not cause another save
    jest.advanceTimersByTime(1000);
    expect(localStorage.setItem).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: Tenant Isolation (Law #6)
// ---------------------------------------------------------------------------

describe('tenant isolation', () => {
  it('prevents cross-tenant reads', () => {
    const state1 = createValidState({ widgets: [createWidget('w1')] });
    const state2 = createValidState({ widgets: [createWidget('w2')] });

    saveCanvasState('suite-A', 'office-1', state1);
    saveCanvasState('suite-B', 'office-1', state2);

    const loadedA = loadCanvasState('suite-A', 'office-1');
    const loadedB = loadCanvasState('suite-B', 'office-1');

    expect(loadedA!.widgets[0].id).toBe('w1');
    expect(loadedB!.widgets[0].id).toBe('w2');
  });

  it('clear does not affect other tenants', () => {
    saveCanvasState('suite-A', 'office-1', createValidState());
    saveCanvasState('suite-B', 'office-1', createValidState());

    clearCanvasState('suite-A', 'office-1');

    expect(loadCanvasState('suite-A', 'office-1')).toBeNull();
    expect(loadCanvasState('suite-B', 'office-1')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: Round-Trip (Save -> Load)
// ---------------------------------------------------------------------------

describe('round-trip save/load', () => {
  it('preserves all widget fields', () => {
    const widget: WidgetState = {
      id: 'widget-123',
      type: 'invoice',
      x: 256,
      y: 512,
      width: 480,
      height: 360,
      zIndex: 5,
    };

    saveCanvasState('suite-1', 'office-1', createValidState({ widgets: [widget] }));
    const loaded = loadCanvasState('suite-1', 'office-1');

    expect(loaded!.widgets[0]).toEqual(widget);
  });

  it('preserves all avatar fields', () => {
    const avatar: AvatarState = { agent: 'finn', x: 120, y: 80 };

    saveCanvasState('suite-1', 'office-1', createValidState({ avatars: [avatar] }));
    const loaded = loadCanvasState('suite-1', 'office-1');

    expect(loaded!.avatars[0]).toEqual(avatar);
  });

  it('handles empty arrays', () => {
    saveCanvasState(
      'suite-1',
      'office-1',
      createValidState({ widgets: [], avatars: [] }),
    );
    const loaded = loadCanvasState('suite-1', 'office-1');

    expect(loaded!.widgets).toEqual([]);
    expect(loaded!.avatars).toEqual([]);
  });
});
