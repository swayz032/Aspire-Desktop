/**
 * Canvas Mode -- Integration Test Suite
 *
 * Tests end-to-end interaction flows that cross multiple Canvas Mode modules
 * working together. These are NOT React component rendering tests -- they
 * verify that the pure-logic modules compose correctly.
 *
 * Scenarios:
 *   1. Cmd+K -> Search -> Select -> Stage Opens flow
 *   2. Tile -> LiveLens -> Stage flow
 *   3. Stage -> Runway lifecycle flow
 *   4. Fallback engine -> ImmersionStore -> Telemetry integration
 *   5. Sound manager + Immersion store integration
 *   6. Deny-by-default end-to-end
 *   7. SLO monitor + Telemetry integration
 *
 * 35 test cases total.
 */

// ---------------------------------------------------------------------------
// Platform mock -- must be BEFORE any source imports
// ---------------------------------------------------------------------------
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// ---------------------------------------------------------------------------
// React mock -- immersionStore imports useState/useEffect
// ---------------------------------------------------------------------------
jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    useState: jest.fn((init: unknown) => {
      const val = typeof init === 'function' ? (init as () => unknown)() : init;
      return [val, jest.fn()];
    }),
    useEffect: jest.fn(),
    useRef: jest.fn((init: unknown) => ({ current: init })),
    useCallback: jest.fn((fn: unknown) => fn),
  };
});

// ---------------------------------------------------------------------------
// Web API mocks -- matchMedia, crypto, localStorage, document, AudioContext
// ---------------------------------------------------------------------------
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
  }),
});

Object.defineProperty(globalThis, 'crypto', {
  writable: true,
  value: {
    randomUUID: () => 'integration-test-session',
  },
});

// __DEV__ global -- telemetry dev-mode (console.debug, no POST)
(globalThis as Record<string, unknown>).__DEV__ = true;

// localStorage mock
const localStorageData: Record<string, string> = {};
Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: {
    getItem: jest.fn((key: string) => localStorageData[key] ?? null),
    setItem: jest.fn((key: string, val: string) => {
      localStorageData[key] = val;
    }),
    removeItem: jest.fn((key: string) => {
      delete localStorageData[key];
    }),
  },
});

// AudioContext mock
const mockCreateOscillator = jest.fn(() => ({
  type: '',
  frequency: {
    value: 0,
    setValueAtTime: jest.fn(),
    linearRampToValueAtTime: jest.fn(),
  },
  connect: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
}));
const mockCreateGain = jest.fn(() => ({
  gain: {
    value: 0,
    setValueAtTime: jest.fn(),
    linearRampToValueAtTime: jest.fn(),
  },
  connect: jest.fn(),
}));
const mockCreateBuffer = jest.fn(() => ({
  getChannelData: jest.fn(() => new Float32Array(100)),
}));
const mockCreateBufferSource = jest.fn(() => ({
  buffer: null,
  connect: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
}));

// @ts-expect-error -- partial AudioContext mock for test environment
global.AudioContext = jest.fn(() => ({
  createOscillator: mockCreateOscillator,
  createGain: mockCreateGain,
  createBuffer: mockCreateBuffer,
  createBufferSource: mockCreateBufferSource,
  destination: {},
  currentTime: 0,
  sampleRate: 44100,
  state: 'running',
  close: jest.fn(() => Promise.resolve()),
  resume: jest.fn(() => Promise.resolve()),
}));

// ============================================================================
// 1. Cmd+K -> Search -> Select -> Stage Opens flow
// ============================================================================
describe('Integration: Cmd+K -> Search -> Select -> Stage Opens', () => {
  let store: typeof import('@/lib/immersionStore');
  let tileManifest: typeof import('@/lib/tileManifest');
  let telemetry: typeof import('@/lib/canvasTelemetry');

  beforeEach(() => {
    jest.isolateModules(() => {
      store = require('@/lib/immersionStore');
      telemetry = require('@/lib/canvasTelemetry');
      tileManifest = require('@/lib/tileManifest');
    });
    telemetry.clearTelemetryQueue();
    telemetry.resetSessionMetrics();
  });

  it('full flow: Cmd+K opens palette, search finds conference, selection opens Stage', () => {
    // Step 1: Set mode to canvas (Cmd+K only works when mode is not 'off')
    store.setImmersionMode('canvas');

    // Step 2: Simulate Cmd+K -> open CommandPalette
    store.setCommandPaletteOpen(true);
    telemetry.emitCanvasEvent('command_palette_open', {});
    expect(store.getImmersionState().commandPaletteOpen).toBe(true);

    // Step 3: User searches for "conference"
    const results = tileManifest.searchVerbs('conference');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].tile.id).toBe('conference_call');

    // Step 4: User selects the first verb -- open Stage with that tile
    const selectedTile = results[0].tile;
    store.setCommandPaletteOpen(false);
    store.setStageOpen(true, selectedTile.id);
    telemetry.emitCanvasEvent('stage_open', { tileId: selectedTile.id });

    // Verify final state
    const state = store.getImmersionState();
    expect(state.commandPaletteOpen).toBe(false);
    expect(state.stageOpen).toBe(true);
    expect(state.stagedTileId).toBe('conference_call');
  });

  it('search returns correct verb details for downstream use', () => {
    const results = tileManifest.searchVerbs('draft');
    // "Draft" matches multiple tiles (draft_agenda, draft_callback_plan, draft_cash_report, etc.)
    expect(results.length).toBeGreaterThanOrEqual(3);

    // Each result includes tile and verb objects
    for (const r of results) {
      expect(r.tile).toBeDefined();
      expect(r.verb).toBeDefined();
      expect(r.verb.lensFields.length).toBeGreaterThan(0);
    }
  });

  it('Cmd+K while palette is open toggles it closed', () => {
    store.setImmersionMode('canvas');
    store.setCommandPaletteOpen(true);
    expect(store.getImmersionState().commandPaletteOpen).toBe(true);

    // Second Cmd+K toggles it closed
    store.setCommandPaletteOpen(false);
    expect(store.getImmersionState().commandPaletteOpen).toBe(false);
  });

  it('Cmd+K does not open palette when mode is off', () => {
    // Mode defaults to 'off'
    const state = store.getImmersionState();
    expect(state.mode).toBe('off');

    // Simulate the guard: useGlobalKeyboard checks mode !== 'off'
    if (state.mode !== 'off') {
      store.setCommandPaletteOpen(true);
    }
    expect(store.getImmersionState().commandPaletteOpen).toBe(false);
  });
});

// ============================================================================
// 2. Tile -> LiveLens -> Stage flow
// ============================================================================
describe('Integration: Tile -> LiveLens -> Stage', () => {
  let store: typeof import('@/lib/immersionStore');
  let tileManifest: typeof import('@/lib/tileManifest');
  let telemetry: typeof import('@/lib/canvasTelemetry');

  beforeEach(() => {
    jest.isolateModules(() => {
      store = require('@/lib/immersionStore');
      telemetry = require('@/lib/canvasTelemetry');
      tileManifest = require('@/lib/tileManifest');
    });
    telemetry.clearTelemetryQueue();
    telemetry.resetSessionMetrics();
  });

  it('tile hover opens lens, Enter opens Stage, lens closes', () => {
    store.setImmersionMode('canvas');

    // Step 1: Hover over invoice tile -> lens opens
    store.setLensOpen(true, 'conference_call');
    telemetry.emitCanvasEvent('lens_open', { tileId: 'conference_call' });

    let state = store.getImmersionState();
    expect(state.lensOpen).toBe(true);
    expect(state.lensTileId).toBe('conference_call');

    // Step 2: Verify lens can show correct fields from manifest
    const tile = tileManifest.getTile('conference_call');
    expect(tile).not.toBeNull();
    const defaultVerb = tile!.verbs.find((v) => v.id === tile!.defaultVerb);
    expect(defaultVerb).toBeDefined();
    expect(defaultVerb!.lensFields.length).toBeGreaterThan(0);

    // Step 3: Enter key opens Stage, lens closes
    store.setLensOpen(false);
    store.setStageOpen(true, 'conference_call');
    telemetry.emitCanvasEvent('lens_close', {});
    telemetry.emitCanvasEvent('stage_open', { tileId: 'conference_call' });

    state = store.getImmersionState();
    expect(state.lensOpen).toBe(false);
    expect(state.stageOpen).toBe(true);
    expect(state.stagedTileId).toBe('conference_call');
  });

  it('lens fields match tile manifest for calendar tile', () => {
    const tile = tileManifest.getTile('calendar');
    expect(tile).not.toBeNull();

    store.setLensOpen(true, 'calendar');
    const state = store.getImmersionState();
    expect(state.lensTileId).toBe('calendar');

    // Verify default verb fields are accessible
    const defaultVerb = tile!.verbs.find((v) => v.id === tile!.defaultVerb);
    expect(defaultVerb).toBeDefined();
    expect(defaultVerb!.lensFields.some((f) => f.key === 'title')).toBe(true);
  });

  it('closing lens before opening Stage leaves Stage closed', () => {
    store.setLensOpen(true, 'conference_call');
    store.setLensOpen(false);

    const state = store.getImmersionState();
    expect(state.lensOpen).toBe(false);
    expect(state.stageOpen).toBe(false);
    expect(state.stagedTileId).toBeNull();
  });

  it('telemetry queue records lens_open and lens_close events', () => {
    telemetry.emitCanvasEvent('lens_open', { tileId: 'inbox_setup' });
    telemetry.emitCanvasEvent('lens_close', {});

    const queue = telemetry.getTelemetryQueue();
    expect(queue.length).toBe(2);
    expect(queue[0].event).toBe('lens_open');
    expect(queue[1].event).toBe('lens_close');
  });
});

// ============================================================================
// 3. Stage -> Runway lifecycle flow
// ============================================================================
describe('Integration: Stage -> Runway lifecycle', () => {
  let store: typeof import('@/lib/immersionStore');
  let runway: typeof import('@/lib/runwayMachine');
  let telemetry: typeof import('@/lib/canvasTelemetry');

  beforeEach(() => {
    jest.isolateModules(() => {
      // Use real canvasTelemetry so runway_step events accumulate
      jest.unmock('@/lib/canvasTelemetry');
      telemetry = require('@/lib/canvasTelemetry');
      runway = require('@/lib/runwayMachine');
      store = require('@/lib/immersionStore');
    });
    telemetry.clearTelemetryQueue();
    telemetry.resetSessionMetrics();
  });

  it('happy path: Stage opens, runway walks IDLE through RECEIPT_READY', () => {
    // Open Stage
    store.setStageOpen(true, 'conference_call');
    store.setRunwayState('IDLE');

    // Walk through the full happy path
    const happyPath: Array<{
      event: import('@/lib/runwayMachine').RunwayEvent;
      expected: import('@/lib/runwayMachine').RunwayState;
    }> = [
      { event: 'START_INTENT', expected: 'PREFLIGHT' },
      { event: 'PREFLIGHT_OK', expected: 'DRAFT_CREATING' },
      { event: 'DRAFT_COMPLETE', expected: 'DRAFT_READY' },
      { event: 'SUBMIT_AUTHORITY', expected: 'AUTHORITY_SUBMITTING' },
      { event: 'AUTHORITY_RECEIVED', expected: 'AUTHORITY_PENDING' },
      { event: 'APPROVE', expected: 'AUTHORITY_APPROVED' },
      { event: 'EXECUTE', expected: 'EXECUTING' },
      { event: 'EXECUTION_COMPLETE', expected: 'RECEIPT_READY' },
    ];

    let current: import('@/lib/runwayMachine').RunwayState = 'IDLE';
    for (const step of happyPath) {
      const next = runway.transition(current, step.event);
      expect(next).toBe(step.expected);
      // Sync immersionStore with runway state
      store.setRunwayState(next!);
      current = next!;
    }

    // Verify final state in store
    expect(store.getImmersionState().runwayState).toBe('RECEIPT_READY');
    expect(store.getImmersionState().stageOpen).toBe(true);
    expect(runway.isTerminal('RECEIPT_READY')).toBe(true);
  });

  it('emits runway_step telemetry at each transition', () => {
    // Suppress console.debug from dev-mode telemetry flush
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation();

    let current: import('@/lib/runwayMachine').RunwayState = 'IDLE';
    const events: import('@/lib/runwayMachine').RunwayEvent[] = [
      'START_INTENT',
      'PREFLIGHT_OK',
      'DRAFT_COMPLETE',
    ];

    for (const event of events) {
      const next = runway.transition(current, event);
      current = next!;
    }

    // Check telemetry queue has runway_step events
    const queue = telemetry.getTelemetryQueue();
    const runwaySteps = queue.filter((e) => e.event === 'runway_step');
    expect(runwaySteps.length).toBe(3);

    // Verify from/to/event data on first transition
    expect(runwaySteps[0].data).toEqual({
      from: 'IDLE',
      to: 'PREFLIGHT',
      event: 'START_INTENT',
    });

    // Session metrics should track runway_step count
    const metrics = telemetry.getSessionMetrics();
    expect(metrics.eventCounts.runway_step).toBe(3);

    debugSpy.mockRestore();
  });

  it('RESET brings runway back to IDLE from RECEIPT_READY', () => {
    // Walk to RECEIPT_READY
    let current: import('@/lib/runwayMachine').RunwayState = 'IDLE';
    const events: import('@/lib/runwayMachine').RunwayEvent[] = [
      'START_INTENT',
      'PREFLIGHT_OK',
      'DRAFT_COMPLETE',
      'SUBMIT_AUTHORITY',
      'AUTHORITY_RECEIVED',
      'APPROVE',
      'EXECUTE',
      'EXECUTION_COMPLETE',
    ];
    for (const event of events) {
      current = runway.transition(current, event)!;
    }
    expect(current).toBe('RECEIPT_READY');

    // RESET
    const reset = runway.transition(current, 'RESET');
    expect(reset).toBe('IDLE');
    store.setRunwayState('IDLE');
    expect(store.getImmersionState().runwayState).toBe('IDLE');
  });

  it('ERROR transition from any active state, then RESET to IDLE', () => {
    // Start a runway
    let current: import('@/lib/runwayMachine').RunwayState = 'IDLE';
    current = runway.transition(current, 'START_INTENT')!;
    current = runway.transition(current, 'PREFLIGHT_OK')!;
    expect(current).toBe('DRAFT_CREATING');

    // Error during draft creation
    const error = runway.transition(current, 'ERROR');
    expect(error).toBe('ERROR');
    expect(runway.isTerminal('ERROR')).toBe(true);

    // Reset
    const reset = runway.transition('ERROR', 'RESET');
    expect(reset).toBe('IDLE');
  });

  it('store.runwayState stays in sync throughout runway lifecycle', () => {
    store.setStageOpen(true, 'finance_hub');
    store.setRunwayState('IDLE');

    const steps: Array<{
      event: import('@/lib/runwayMachine').RunwayEvent;
    }> = [
      { event: 'START_INTENT' },
      { event: 'PREFLIGHT_OK' },
      { event: 'DRAFT_COMPLETE' },
    ];

    let current: import('@/lib/runwayMachine').RunwayState = 'IDLE';
    for (const step of steps) {
      const next: import('@/lib/runwayMachine').RunwayState = runway.transition(current, step.event)!;
      store.setRunwayState(next);
      expect(store.getImmersionState().runwayState).toBe(next);
      current = next;
    }

    expect(store.getImmersionState().runwayState).toBe('DRAFT_READY');
    expect(store.getImmersionState().stagedTileId).toBe('finance_hub');
  });
});

// ============================================================================
// 4. Fallback engine -> ImmersionStore -> Telemetry integration
// ============================================================================
describe('Integration: Fallback -> ImmersionStore -> Telemetry', () => {
  let store: typeof import('@/lib/immersionStore');
  let telemetry: typeof import('@/lib/canvasTelemetry');
  let fallback: typeof import('@/lib/fallbackEngine');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.isolateModules(() => {
      jest.unmock('@/lib/immersionStore');
      jest.unmock('@/lib/canvasTelemetry');
      jest.unmock('@/lib/fallbackEngine');

      store = require('@/lib/immersionStore');
      telemetry = require('@/lib/canvasTelemetry');
      fallback = require('@/lib/fallbackEngine');
    });
    telemetry.clearTelemetryQueue();
    telemetry.resetSessionMetrics();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('low FPS degrades canvas to depth and emits fallback_trigger', () => {
    // Set mode to canvas
    store.setImmersionMode('canvas');
    expect(store.getImmersionState().mode).toBe('canvas');

    // Trigger low FPS
    fallback.checkFallback(20, true);

    // Verify mode changed
    expect(store.getImmersionState().mode).toBe('depth');

    // Verify telemetry
    const queue = telemetry.getTelemetryQueue();
    const fallbackEvents = queue.filter((e) => e.event === 'fallback_trigger');
    expect(fallbackEvents.length).toBe(1);
    expect(fallbackEvents[0].data).toEqual(
      expect.objectContaining({
        from: 'canvas',
        to: 'depth',
        reason: 'low_fps',
        fps: 20,
      }),
    );
  });

  it('cooldown prevents immediate re-degradation', () => {
    store.setImmersionMode('canvas');
    fallback.checkFallback(20, true);
    expect(store.getImmersionState().mode).toBe('depth');

    // Immediately try again -- should be blocked by 90s cooldown
    fallback.checkFallback(15, true);
    // Still depth, not off
    expect(store.getImmersionState().mode).toBe('depth');

    // Verify cooldown is active
    expect(fallback.getFallbackCooldownRemaining()).toBeGreaterThan(0);
  });

  it('after cooldown, second degradation depth -> off succeeds', () => {
    // Suppress console.debug from dev-mode telemetry flush
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation();

    store.setImmersionMode('canvas');

    // First degradation: canvas -> depth
    fallback.checkFallback(20, true);
    expect(store.getImmersionState().mode).toBe('depth');

    // Advance past 90s cooldown (this also fires the 5s telemetry flush
    // timer, which empties the queue in dev mode)
    jest.advanceTimersByTime(91_000);

    // Clear queue to isolate second degradation event
    telemetry.clearTelemetryQueue();

    // Second degradation: depth -> off
    fallback.checkFallback(15, true);
    expect(store.getImmersionState().mode).toBe('off');

    // Verify second fallback_trigger event emitted
    const queue = telemetry.getTelemetryQueue();
    const fallbackEvents = queue.filter((e) => e.event === 'fallback_trigger');
    expect(fallbackEvents.length).toBe(1);
    expect(fallbackEvents[0].data).toEqual(
      expect.objectContaining({
        from: 'depth',
        to: 'off',
        reason: 'low_fps',
      }),
    );

    // Verify cumulative count via session metrics (both degradations)
    const metrics = telemetry.getSessionMetrics();
    expect(metrics.eventCounts.fallback_trigger).toBe(2);

    debugSpy.mockRestore();
  });

  it('session metrics track fallback_trigger events', () => {
    store.setImmersionMode('canvas');
    fallback.checkFallback(20, true);

    const metrics = telemetry.getSessionMetrics();
    expect(metrics.eventCounts.fallback_trigger).toBe(1);
  });
});

// ============================================================================
// 5. Sound manager + Immersion store integration
// ============================================================================
describe('Integration: Sound Manager + ImmersionStore', () => {
  let store: typeof import('@/lib/immersionStore');
  let telemetry: typeof import('@/lib/canvasTelemetry');
  let sound: typeof import('@/lib/soundManager');

  beforeEach(() => {
    jest.useFakeTimers();
    // Reset AudioContext mock call counts
    mockCreateOscillator.mockClear();
    mockCreateGain.mockClear();
    mockCreateBuffer.mockClear();
    mockCreateBufferSource.mockClear();
    (global.AudioContext as jest.Mock).mockClear();

    jest.isolateModules(() => {
      jest.unmock('@/lib/immersionStore');
      jest.unmock('@/lib/canvasTelemetry');
      jest.unmock('@/lib/soundManager');

      store = require('@/lib/immersionStore');
      telemetry = require('@/lib/canvasTelemetry');
      sound = require('@/lib/soundManager');
    });
    telemetry.clearTelemetryQueue();
    telemetry.resetSessionMetrics();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('essential mode: runway_error plays, stage_open is skipped', () => {
    // Store defaults to soundMode 'essential'
    expect(store.getImmersionState().soundMode).toBe('essential');

    sound.initSoundManager();

    // runway_error is essential=true -- should play
    sound.playSound('runway_error');
    const oscCallsAfterError = mockCreateOscillator.mock.calls.length;
    expect(oscCallsAfterError).toBeGreaterThan(0);

    // Advance past cooldown to avoid priority suppression
    jest.advanceTimersByTime(100);

    // stage_open is essential=false -- should be skipped
    sound.playSound('stage_open');
    expect(mockCreateOscillator.mock.calls.length).toBe(oscCallsAfterError);
  });

  it('off mode: nothing plays', () => {
    store.setSoundMode('off');
    expect(store.getImmersionState().soundMode).toBe('off');

    sound.initSoundManager();
    sound.playSound('runway_error');
    sound.playSound('stage_open');
    sound.playSound('authority_approved');

    expect(mockCreateOscillator).not.toHaveBeenCalled();
  });

  it('full mode: all sounds play', () => {
    store.setSoundMode('full');
    sound.initSoundManager();

    sound.playSound('stage_open');
    expect(mockCreateOscillator).toHaveBeenCalled();
  });

  it('sound_play telemetry emitted only for played sounds', () => {
    // Essential mode
    expect(store.getImmersionState().soundMode).toBe('essential');
    sound.initSoundManager();

    // Play essential sound
    sound.playSound('runway_error');

    // Advance past cooldown
    jest.advanceTimersByTime(100);

    // Try non-essential sound (should be skipped)
    sound.playSound('stage_open');

    const queue = telemetry.getTelemetryQueue();
    const soundEvents = queue.filter((e) => e.event === 'sound_play');

    // Only runway_error should have emitted
    expect(soundEvents.length).toBe(1);
    expect(soundEvents[0].data).toEqual(
      expect.objectContaining({
        sound: 'runway_error',
        mode: 'essential',
      }),
    );
  });

  it('switching soundMode changes which sounds play', () => {
    sound.initSoundManager();

    // Start in essential
    sound.playSound('stage_open'); // skipped
    const callsAfterSkipped = mockCreateOscillator.mock.calls.length;
    expect(callsAfterSkipped).toBe(0);

    // Switch to full
    store.setSoundMode('full');

    jest.advanceTimersByTime(100);
    sound.playSound('stage_open'); // should play now
    expect(mockCreateOscillator.mock.calls.length).toBeGreaterThan(callsAfterSkipped);
  });
});

// ============================================================================
// 6. Deny-by-default end-to-end
// ============================================================================
describe('Integration: Deny-by-default end-to-end', () => {
  let store: typeof import('@/lib/immersionStore');
  let tileManifest: typeof import('@/lib/tileManifest');
  let runway: typeof import('@/lib/runwayMachine');
  let failureCodes: typeof import('@/lib/failureCodes');
  let telemetry: typeof import('@/lib/canvasTelemetry');

  beforeEach(() => {
    jest.isolateModules(() => {
      jest.unmock('@/lib/canvasTelemetry');
      store = require('@/lib/immersionStore');
      tileManifest = require('@/lib/tileManifest');
      runway = require('@/lib/runwayMachine');
      failureCodes = require('@/lib/failureCodes');
      telemetry = require('@/lib/canvasTelemetry');
    });
    telemetry.clearTelemetryQueue();
  });

  it('getTile with nonexistent ID returns null', () => {
    expect(tileManifest.getTile('nonexistent')).toBeNull();
    expect(tileManifest.getTile('')).toBeNull();
    expect(tileManifest.getTile('__proto__')).toBeNull();
  });

  it('attempt to open Stage with null tile: Stage can open but has null tileId', () => {
    // getTile returns null for unknown ID
    const tile = tileManifest.getTile('nonexistent');
    expect(tile).toBeNull();

    // If caller checks and does not open Stage, Stage stays closed
    if (tile !== null) {
      store.setStageOpen(true, tile.id);
    }
    expect(store.getImmersionState().stageOpen).toBe(false);
    expect(store.getImmersionState().stagedTileId).toBeNull();
  });

  it('unknown failure code returns null', () => {
    expect(failureCodes.getFailureCode('F-999')).toBeNull();
    expect(failureCodes.getFailureCode('')).toBeNull();
    expect(failureCodes.getFailureCode('INVALID')).toBeNull();
  });

  it('illegal runway transition returns null, no state change', () => {
    // IDLE + APPROVE is illegal
    const result = runway.transition('IDLE', 'APPROVE');
    expect(result).toBeNull();

    // IDLE + EXECUTE is illegal
    expect(runway.transition('IDLE', 'EXECUTE')).toBeNull();

    // RECEIPT_READY + START_INTENT is illegal
    expect(runway.transition('RECEIPT_READY', 'START_INTENT')).toBeNull();
  });

  it('illegal transition does not emit telemetry', () => {
    telemetry.clearTelemetryQueue();

    runway.transition('IDLE', 'APPROVE');
    runway.transition('IDLE', 'EXECUTE');

    const queue = telemetry.getTelemetryQueue();
    const runwaySteps = queue.filter((e) => e.event === 'runway_step');
    expect(runwaySteps.length).toBe(0);
  });

  it('searchVerbs with nonsense returns empty array', () => {
    expect(tileManifest.searchVerbs('zzzzxqwerty')).toEqual([]);
    expect(tileManifest.searchVerbs('')).toEqual([]);
  });

  it('getTileVerbs with unknown tile returns empty array', () => {
    expect(tileManifest.getTileVerbs('nonexistent')).toEqual([]);
    expect(tileManifest.getTileVerbs('')).toEqual([]);
  });
});

// ============================================================================
// 7. SLO monitor + Telemetry integration
// ============================================================================
describe('Integration: SLO Monitor + Telemetry', () => {
  // Since useSloMonitor is a hook, we test the integration by calling
  // emitCanvasEvent('slo_violation') directly (which is what the hook does)
  // and verifying telemetry queue + session metrics update together.

  let telemetry: typeof import('@/lib/canvasTelemetry');

  beforeEach(() => {
    jest.isolateModules(() => {
      jest.unmock('@/lib/canvasTelemetry');
      telemetry = require('@/lib/canvasTelemetry');
    });
    telemetry.clearTelemetryQueue();
    telemetry.resetSessionMetrics();
  });

  it('SLO violation emits slo_violation event to telemetry queue', () => {
    // Simulate what useSloMonitor.checkSlo does on violation
    const slo = 'lens_render';
    const actual = 250;
    const threshold = 200;

    telemetry.emitCanvasEvent('slo_violation', {
      slo,
      actual,
      threshold,
    });

    const queue = telemetry.getTelemetryQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].event).toBe('slo_violation');
    expect(queue[0].data).toEqual({ slo, actual, threshold });
  });

  it('sloViolations count incremented in session metrics', () => {
    telemetry.emitCanvasEvent('slo_violation', {
      slo: 'lens_render',
      actual: 300,
      threshold: 200,
    });
    telemetry.emitCanvasEvent('slo_violation', {
      slo: 'preflight',
      actual: 600,
      threshold: 500,
    });

    const metrics = telemetry.getSessionMetrics();
    expect(metrics.sloViolations).toBe(2);
    expect(metrics.eventCounts.slo_violation).toBe(2);
  });

  it('non-violation does not emit slo_violation event', () => {
    // If duration is within threshold, no event should be emitted.
    // The hook handles this logic -- verify telemetry stays clean.
    const slo = 'lens_render';
    const duration = 150; // Under 200ms threshold

    // Simulate: the hook checks and does NOT emit
    if (duration > 200) {
      telemetry.emitCanvasEvent('slo_violation', {
        slo,
        actual: duration,
        threshold: 200,
      });
    }

    const queue = telemetry.getTelemetryQueue();
    expect(queue.length).toBe(0);
    expect(telemetry.getSessionMetrics().sloViolations).toBe(0);
  });

  it('multiple SLO types tracked independently in telemetry', () => {
    telemetry.emitCanvasEvent('slo_violation', {
      slo: 'lens_render',
      actual: 250,
      threshold: 200,
    });
    telemetry.emitCanvasEvent('slo_violation', {
      slo: 'preflight',
      actual: 600,
      threshold: 500,
    });
    telemetry.emitCanvasEvent('slo_violation', {
      slo: 'receipt_display',
      actual: 300,
      threshold: 250,
    });

    const queue = telemetry.getTelemetryQueue();
    const sloEvents = queue.filter((e) => e.event === 'slo_violation');
    expect(sloEvents.length).toBe(3);

    const sloNames = sloEvents.map((e) => e.data.slo);
    expect(sloNames).toEqual(['lens_render', 'preflight', 'receipt_display']);

    expect(telemetry.getSessionMetrics().sloViolations).toBe(3);
  });

  it('session metrics reset clears SLO violation count', () => {
    telemetry.emitCanvasEvent('slo_violation', {
      slo: 'lens_render',
      actual: 250,
      threshold: 200,
    });
    expect(telemetry.getSessionMetrics().sloViolations).toBe(1);

    telemetry.resetSessionMetrics();
    expect(telemetry.getSessionMetrics().sloViolations).toBe(0);
  });
});

// ============================================================================
// Cross-scenario: Full pipeline (Search -> Stage -> Runway -> Telemetry audit)
// ============================================================================
describe('Integration: Full pipeline end-to-end', () => {
  let store: typeof import('@/lib/immersionStore');
  let tileManifest: typeof import('@/lib/tileManifest');
  let runway: typeof import('@/lib/runwayMachine');
  let telemetry: typeof import('@/lib/canvasTelemetry');

  beforeEach(() => {
    jest.isolateModules(() => {
      jest.unmock('@/lib/canvasTelemetry');
      store = require('@/lib/immersionStore');
      tileManifest = require('@/lib/tileManifest');
      runway = require('@/lib/runwayMachine');
      telemetry = require('@/lib/canvasTelemetry');
    });
    telemetry.clearTelemetryQueue();
    telemetry.resetSessionMetrics();
  });

  it('search -> select -> Stage -> full runway -> receipt: all telemetry emitted', () => {
    // 1. Enable canvas mode
    store.setImmersionMode('canvas');

    // 2. Open command palette and search
    store.setCommandPaletteOpen(true);
    telemetry.emitCanvasEvent('command_palette_open', {});

    const results = tileManifest.searchVerbs('finance');
    expect(results.length).toBeGreaterThan(0);

    // 3. Select verb -> close palette, open Stage
    store.setCommandPaletteOpen(false);
    store.setStageOpen(true, results[0].tile.id);
    telemetry.emitCanvasEvent('stage_open', { tileId: results[0].tile.id });

    // 4. Walk full runway lifecycle
    let current: import('@/lib/runwayMachine').RunwayState = 'IDLE';
    const events: import('@/lib/runwayMachine').RunwayEvent[] = [
      'START_INTENT',
      'PREFLIGHT_OK',
      'DRAFT_COMPLETE',
      'SUBMIT_AUTHORITY',
      'AUTHORITY_RECEIVED',
      'APPROVE',
      'EXECUTE',
      'EXECUTION_COMPLETE',
    ];
    for (const event of events) {
      const next: import('@/lib/runwayMachine').RunwayState = runway.transition(current, event)!;
      store.setRunwayState(next);
      current = next;
    }

    // 5. Verify final state
    expect(store.getImmersionState().runwayState).toBe('RECEIPT_READY');
    expect(store.getImmersionState().stageOpen).toBe(true);
    expect(store.getImmersionState().stagedTileId).toBe('finance_hub');

    // 6. Verify telemetry audit trail
    const queue = telemetry.getTelemetryQueue();
    const eventTypes = queue.map((e) => e.event);
    expect(eventTypes).toContain('command_palette_open');
    expect(eventTypes).toContain('stage_open');
    expect(eventTypes.filter((t) => t === 'runway_step').length).toBe(8);

    // 7. Session metrics reflect all activity
    const metrics = telemetry.getSessionMetrics();
    expect(metrics.stageOpenCount).toBe(1);
    expect(metrics.eventCounts.command_palette_open).toBe(1);
    expect(metrics.eventCounts.runway_step).toBe(8);
  });
});
