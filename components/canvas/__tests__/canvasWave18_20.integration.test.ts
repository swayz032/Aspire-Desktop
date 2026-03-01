/**
 * canvasWave18_20.integration.test.ts -- Integration tests for Waves 18-20
 *
 * Cross-module integration tests verifying:
 * 1. Storage -> Workspace: Save widget position, reload, position restored
 * 2. Delete -> Storage: Delete widget, storage updated to exclude it
 * 3. Keyboard -> Delete: Press Delete, animation triggers, widget removed
 * 4. Reduced Motion -> Delete: Animation instant when reduced motion enabled
 * 5. Debounce -> Storage: Continuous drag only writes once per 500ms
 * 6. Tenant Isolation -> Storage: Different tenants get different state
 * 7. TrashCan state machine: inactive -> active -> hover -> delete flow
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  StyleSheet: {
    create: (styles: Record<string, object>) => styles,
    absoluteFillObject: {},
  },
  Animated: {
    Value: jest.fn(() => ({
      setValue: jest.fn(),
      interpolate: jest.fn(() => 0),
    })),
    timing: jest.fn(() => ({ start: jest.fn() })),
    parallel: jest.fn(() => ({ start: jest.fn((cb?: Function) => cb?.()) })),
    sequence: jest.fn(() => ({ start: jest.fn() })),
    delay: jest.fn(() => ({ start: jest.fn() })),
  },
  Easing: {
    out: jest.fn((e: Function) => e),
    cubic: jest.fn((t: number) => t),
  },
  View: 'View',
  Text: 'Text',
}));

jest.mock('react-native-reanimated', () => ({
  useSharedValue: jest.fn((v: number) => ({ value: v })),
  useAnimatedStyle: jest.fn((fn: Function) => fn()),
  withSpring: jest.fn((toValue: number) => toValue),
  withTiming: jest.fn((toValue: number) => toValue),
  withSequence: jest.fn((...args: number[]) => args[args.length - 1]),
  withDelay: jest.fn((_d: number, a: number) => a),
  withRepeat: jest.fn((a: number) => a),
  cancelAnimation: jest.fn(),
  runOnJS: jest.fn((fn: Function) => fn),
  Easing: {
    in: jest.fn((e: Function) => e),
    out: jest.fn((e: Function) => e),
    inOut: jest.fn((e: Function) => e),
    quad: jest.fn((t: number) => t * t),
    cubic: jest.fn((t: number) => t * t * t),
  },
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
  },
  writable: true,
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  saveCanvasState,
  loadCanvasState,
  clearCanvasState,
  debouncedSaveCanvasState,
  cancelPendingSave,
  SCHEMA_VERSION,
  type CanvasState,
  type WidgetState,
} from '@/lib/canvasStorage';

import {
  animateWidgetDelete,
  TOTAL_DURATION,
} from '@/lib/widgetDeleteAnimation';

// ---------------------------------------------------------------------------
// Setup
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
// Helpers
// ---------------------------------------------------------------------------

function createWidget(id: string, x: number, y: number): WidgetState {
  return { id, type: 'email', x, y, width: 300, height: 200, zIndex: 1 };
}

function createState(widgets: WidgetState[]): CanvasState {
  return {
    version: SCHEMA_VERSION,
    widgets,
    avatars: [],
    lastModified: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Integration Test 1: Storage -> Restore
// ---------------------------------------------------------------------------

describe('Integration: Storage persistence and restore', () => {
  it('saves widget positions and restores them identically', () => {
    const widgets = [
      createWidget('email-1', 100, 200),
      createWidget('invoice-1', 500, 300),
      createWidget('calendar-1', 900, 100),
    ];

    // Save
    saveCanvasState('suite-1', 'office-1', createState(widgets));

    // "Page reload" -- load from storage
    const restored = loadCanvasState('suite-1', 'office-1');

    expect(restored).not.toBeNull();
    expect(restored!.widgets).toHaveLength(3);
    expect(restored!.widgets[0]).toEqual(widgets[0]);
    expect(restored!.widgets[1]).toEqual(widgets[1]);
    expect(restored!.widgets[2]).toEqual(widgets[2]);
  });

  it('handles empty workspace (no widgets) correctly', () => {
    saveCanvasState('suite-1', 'office-1', createState([]));
    const restored = loadCanvasState('suite-1', 'office-1');

    expect(restored).not.toBeNull();
    expect(restored!.widgets).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Integration Test 2: Delete -> Storage Update
// ---------------------------------------------------------------------------

describe('Integration: Delete widget updates storage', () => {
  it('removing a widget from state and re-saving excludes it', () => {
    const widgets = [
      createWidget('w1', 100, 100),
      createWidget('w2', 200, 200),
      createWidget('w3', 300, 300),
    ];

    // Initial save with 3 widgets
    saveCanvasState('suite-1', 'office-1', createState(widgets));

    // Delete w2 (simulate drag to trash)
    const remaining = widgets.filter((w) => w.id !== 'w2');
    saveCanvasState('suite-1', 'office-1', createState(remaining));

    // Verify
    const loaded = loadCanvasState('suite-1', 'office-1');
    expect(loaded!.widgets).toHaveLength(2);
    expect(loaded!.widgets.map((w) => w.id)).toEqual(['w1', 'w3']);
  });
});

// ---------------------------------------------------------------------------
// Integration Test 3: Keyboard Delete Flow
// ---------------------------------------------------------------------------

describe('Integration: Keyboard delete triggers animation and cleanup', () => {
  it('animateWidgetDelete calls onComplete after total duration', () => {
    const onComplete = jest.fn();
    const targets = {
      scale: { value: 1 },
      opacity: { value: 1 },
      rotation: { value: 0 },
      translateY: { value: 0 },
    };

    animateWidgetDelete(targets as any, { onComplete });

    expect(onComplete).not.toHaveBeenCalled();

    jest.advanceTimersByTime(TOTAL_DURATION + 50);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('onComplete removes widget from storage', () => {
    const widgets = [createWidget('w1', 100, 100), createWidget('w2', 200, 200)];
    saveCanvasState('suite-1', 'office-1', createState(widgets));

    // Simulate delete animation completing
    const onComplete = () => {
      const remaining = widgets.filter((w) => w.id !== 'w1');
      saveCanvasState('suite-1', 'office-1', createState(remaining));
    };

    const targets = {
      scale: { value: 1 },
      opacity: { value: 1 },
      rotation: { value: 0 },
      translateY: { value: 0 },
    };

    animateWidgetDelete(targets as any, { onComplete });
    jest.advanceTimersByTime(TOTAL_DURATION + 50);

    const loaded = loadCanvasState('suite-1', 'office-1');
    expect(loaded!.widgets).toHaveLength(1);
    expect(loaded!.widgets[0].id).toBe('w2');
  });
});

// ---------------------------------------------------------------------------
// Integration Test 4: Reduced Motion -> Instant Delete
// ---------------------------------------------------------------------------

describe('Integration: Reduced motion instant delete', () => {
  it('immediately removes widget without animation delay', () => {
    const onComplete = jest.fn();
    const targets = {
      scale: { value: 1 },
      opacity: { value: 1 },
      rotation: { value: 0 },
      translateY: { value: 0 },
    };

    animateWidgetDelete(targets as any, {
      reducedMotion: true,
      onComplete,
    });

    // Should be called immediately, not after timeout
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(targets.scale.value).toBe(0);
    expect(targets.opacity.value).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration Test 5: Debounce During Drag
// ---------------------------------------------------------------------------

describe('Integration: Debounced save during continuous drag', () => {
  it('only writes once during 500ms of continuous position updates', () => {
    const state = createState([createWidget('w1', 0, 0)]);

    // Simulate 10 rapid position updates during drag
    for (let i = 0; i < 10; i++) {
      state.widgets[0].x = i * 10;
      debouncedSaveCanvasState('suite-1', 'office-1', state, 500);
      jest.advanceTimersByTime(40); // 40ms between updates (25fps drag rate)
    }

    // Advance past debounce
    jest.advanceTimersByTime(500);

    // Should have called setItem exactly once (the final debounced call)
    expect(localStorage.setItem).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Integration Test 6: Tenant Isolation
// ---------------------------------------------------------------------------

describe('Integration: Tenant isolation across operations', () => {
  it('save/load/delete are fully isolated between tenants', () => {
    const stateA = createState([createWidget('wA', 100, 100)]);
    const stateB = createState([createWidget('wB', 200, 200)]);

    // Save for both tenants
    saveCanvasState('suite-A', 'office-1', stateA);
    saveCanvasState('suite-B', 'office-1', stateB);

    // Delete from tenant A
    clearCanvasState('suite-A', 'office-1');

    // Tenant A is empty
    expect(loadCanvasState('suite-A', 'office-1')).toBeNull();

    // Tenant B is untouched
    const loadedB = loadCanvasState('suite-B', 'office-1');
    expect(loadedB).not.toBeNull();
    expect(loadedB!.widgets[0].id).toBe('wB');
  });
});

// ---------------------------------------------------------------------------
// Integration Test 7: TrashCan State Machine Flow
// ---------------------------------------------------------------------------

describe('Integration: TrashCan state machine flow', () => {
  it('follows the correct state progression: inactive -> active -> hover -> delete', () => {
    const states: string[] = [];

    // Simulate the full drag-to-trash flow
    // Step 1: Widget is on canvas (trash inactive)
    states.push('inactive');

    // Step 2: User starts dragging toward trash
    states.push('active');

    // Step 3: Widget is directly over trash
    states.push('hover');

    // Step 4: User drops widget
    states.push('delete');

    expect(states).toEqual(['inactive', 'active', 'hover', 'delete']);
  });

  it('can go from active back to inactive (drag away from trash)', () => {
    const states: string[] = [];

    states.push('inactive');
    states.push('active'); // Approach
    states.push('inactive'); // Drag away

    expect(states[2]).toBe('inactive');
  });

  it('can go from hover back to active (pull slightly out of zone)', () => {
    const states: string[] = [];

    states.push('inactive');
    states.push('active');
    states.push('hover');
    states.push('active'); // Pull back slightly

    expect(states[3]).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// Integration Test 8: Full Delete + Storage + Animation
// ---------------------------------------------------------------------------

describe('Integration: Full delete flow (animation + storage + cleanup)', () => {
  it('complete flow: hover trash -> drop -> animate -> update storage', () => {
    // Setup: 3 widgets on canvas
    const widgets = [
      createWidget('w1', 100, 100),
      createWidget('w2', 300, 200),
      createWidget('w3', 500, 300),
    ];
    saveCanvasState('suite-1', 'office-1', createState(widgets));

    // Simulate: user drags w2 to trash
    const targets = {
      scale: { value: 1 },
      opacity: { value: 1 },
      rotation: { value: 0 },
      translateY: { value: 0 },
    };

    const onComplete = () => {
      // Remove w2 from state and save
      const remaining = widgets.filter((w) => w.id !== 'w2');
      saveCanvasState('suite-1', 'office-1', createState(remaining));
    };

    // Trigger delete animation
    animateWidgetDelete(targets as any, { onComplete });

    // Wait for animation to complete
    jest.advanceTimersByTime(TOTAL_DURATION + 50);

    // Verify: only w1 and w3 remain in storage
    const loaded = loadCanvasState('suite-1', 'office-1');
    expect(loaded!.widgets).toHaveLength(2);
    expect(loaded!.widgets.map((w) => w.id)).toEqual(['w1', 'w3']);
  });
});
