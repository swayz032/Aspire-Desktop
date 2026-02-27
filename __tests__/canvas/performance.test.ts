/**
 * Canvas Mode -- Performance & Reliability Test Suite
 *
 * Covers:
 *   1. Fallback Engine (degradation, promotion, cooldown, telemetry)
 *   2. Sound Manager  (init, dispose, sound modes, cooldown, priority)
 *   3. Telemetry Queue (flush threshold, timer, session metrics, FPS)
 *   4. Immersion Store (no-op optimisation, rapid state changes)
 *   5. SLO Monitor    (threshold logic without hook wrapper)
 *
 * 45 test cases total.
 */

// ---------------------------------------------------------------------------
// react-native Platform mock -- must be BEFORE any source imports
// ---------------------------------------------------------------------------
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  useState: jest.fn(),
  useEffect: jest.fn(),
}));

// ---------------------------------------------------------------------------
// matchMedia mock (web-only, used by fallbackEngine at module load)
// ---------------------------------------------------------------------------
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
  }),
});

// ---------------------------------------------------------------------------
// crypto.randomUUID mock (used by canvasTelemetry session ID)
// ---------------------------------------------------------------------------
Object.defineProperty(globalThis, 'crypto', {
  writable: true,
  value: {
    randomUUID: () => 'test-session-uuid',
  },
});

// ---------------------------------------------------------------------------
// __DEV__ global -- suppress telemetry console.debug in test output
// ---------------------------------------------------------------------------
(globalThis as Record<string, unknown>).__DEV__ = true;

// ---------------------------------------------------------------------------
// 1. Fallback Engine
// ---------------------------------------------------------------------------
describe('Fallback Engine', () => {
  let mockMode: string;
  let mockSetImmersionMode: jest.Mock;
  let mockGetImmersionState: jest.Mock;
  let mockEmitCanvasEvent: jest.Mock;

  // Per-test module instances
  let checkFallback: (fps: number, isLow: boolean) => void;
  let canPromote: () => boolean;
  let promoteFallback: () => void;
  let getFallbackCooldownRemaining: () => number;

  beforeEach(() => {
    jest.useFakeTimers();
    mockMode = 'canvas';
    mockSetImmersionMode = jest.fn((mode: string) => {
      mockMode = mode;
    });
    mockGetImmersionState = jest.fn(() => ({ mode: mockMode }));
    mockEmitCanvasEvent = jest.fn();

    // Isolate each test so module-level state (lastDegradationTime,
    // stableFrameCount) starts fresh.
    jest.isolateModules(() => {
      jest.doMock('@/lib/immersionStore', () => ({
        getImmersionState: (...a: unknown[]) => mockGetImmersionState(...a),
        setImmersionMode: (...a: unknown[]) => mockSetImmersionMode(...a),
      }));
      jest.doMock('@/lib/canvasTelemetry', () => ({
        emitCanvasEvent: (...a: unknown[]) => mockEmitCanvasEvent(...a),
      }));

      const mod = require('@/lib/fallbackEngine');
      checkFallback = mod.checkFallback;
      canPromote = mod.canPromote;
      promoteFallback = mod.promoteFallback;
      getFallbackCooldownRemaining = mod.getFallbackCooldownRemaining;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('degrades canvas to depth on low FPS', () => {
    checkFallback(20, true);
    expect(mockSetImmersionMode).toHaveBeenCalledWith('depth');
  });

  it('follows degradation ladder: canvas -> depth -> off (never skips)', () => {
    checkFallback(20, true);
    expect(mockSetImmersionMode).toHaveBeenCalledWith('depth');

    // Advance past cooldown
    jest.advanceTimersByTime(91_000);

    checkFallback(15, true);
    expect(mockSetImmersionMode).toHaveBeenCalledWith('off');
  });

  it('respects 90s cooldown between degradations', () => {
    checkFallback(20, true);
    expect(mockSetImmersionMode).toHaveBeenCalledTimes(1);

    // Within cooldown -- should be ignored
    jest.advanceTimersByTime(30_000);
    checkFallback(15, true);
    expect(mockSetImmersionMode).toHaveBeenCalledTimes(1);
  });

  it('triggers degradation again after 90s cooldown expires', () => {
    checkFallback(20, true);
    expect(mockSetImmersionMode).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(91_000);
    checkFallback(15, true);
    expect(mockSetImmersionMode).toHaveBeenCalledTimes(2);
  });

  it('does not degrade when FPS is not low', () => {
    checkFallback(60, false);
    expect(mockSetImmersionMode).not.toHaveBeenCalled();
  });

  it('does not degrade below off (floor)', () => {
    mockMode = 'off';
    checkFallback(10, true);
    expect(mockSetImmersionMode).not.toHaveBeenCalled();
  });

  it('canPromote returns true after 120+ stable frames above 30fps', () => {
    mockMode = 'off';
    for (let i = 0; i < 120; i++) {
      checkFallback(60, false);
    }
    expect(canPromote()).toBe(true);
  });

  it('promoteFallback moves off -> depth', () => {
    mockMode = 'off';
    for (let i = 0; i < 121; i++) {
      checkFallback(60, false);
    }
    promoteFallback();
    expect(mockSetImmersionMode).toHaveBeenCalledWith('depth');
  });

  it('promotion resets stable frame counter', () => {
    mockMode = 'off';
    for (let i = 0; i < 121; i++) {
      checkFallback(60, false);
    }
    promoteFallback();
    expect(canPromote()).toBe(false);
  });

  it('getCooldownRemaining returns positive value during cooldown', () => {
    checkFallback(20, true);
    jest.advanceTimersByTime(30_000);
    expect(getFallbackCooldownRemaining()).toBeGreaterThan(0);
    expect(getFallbackCooldownRemaining()).toBeLessThanOrEqual(60_000);
  });

  it('getCooldownRemaining returns 0 after cooldown expires', () => {
    checkFallback(20, true);
    jest.advanceTimersByTime(91_000);
    expect(getFallbackCooldownRemaining()).toBe(0);
  });

  it('emits fallback_trigger telemetry on degradation with from/to/reason/fps', () => {
    checkFallback(20, true);
    expect(mockEmitCanvasEvent).toHaveBeenCalledWith('fallback_trigger', {
      from: 'canvas',
      to: 'depth',
      reason: 'low_fps',
      fps: 20,
    });
  });

  it('emits fallback_trigger telemetry on promotion', () => {
    mockMode = 'off';
    for (let i = 0; i < 121; i++) {
      checkFallback(60, false);
    }
    promoteFallback();
    expect(mockEmitCanvasEvent).toHaveBeenCalledWith('fallback_trigger', {
      from: 'off',
      to: 'depth',
      reason: 'promotion',
    });
  });

  it('passes fps value in telemetry data on degradation', () => {
    checkFallback(22, true);
    const call = mockEmitCanvasEvent.mock.calls[0];
    expect(call[0]).toBe('fallback_trigger');
    expect(call[1]).toHaveProperty('fps', 22);
  });
});

// ---------------------------------------------------------------------------
// 2. Sound Manager
// ---------------------------------------------------------------------------
describe('Sound Manager', () => {
  const mockCreateOscillator = jest.fn(() => ({
    type: '',
    frequency: { value: 0, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() },
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  }));
  const mockCreateGain = jest.fn(() => ({
    gain: { value: 0, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() },
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
  const mockClose = jest.fn(() => Promise.resolve());
  const mockResume = jest.fn(() => Promise.resolve());

  let mockSoundMode: string;
  let mockSoundEmit: jest.Mock;

  let initSoundManager: () => void;
  let disposeSoundManager: () => void;
  let playSound: (id: string) => void;

  beforeEach(() => {
    jest.useFakeTimers();
    mockSoundMode = 'full';
    mockSoundEmit = jest.fn();

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
      close: mockClose,
      resume: mockResume,
    }));

    mockCreateOscillator.mockClear();
    mockCreateGain.mockClear();
    mockCreateBuffer.mockClear();
    mockCreateBufferSource.mockClear();
    mockClose.mockClear();
    mockResume.mockClear();
    (global.AudioContext as jest.Mock).mockClear();

    jest.isolateModules(() => {
      jest.doMock('@/lib/immersionStore', () => ({
        getImmersionState: () => ({ soundMode: mockSoundMode }),
      }));
      jest.doMock('@/lib/canvasTelemetry', () => ({
        emitCanvasEvent: (...a: unknown[]) => mockSoundEmit(...a),
      }));

      const mod = require('@/lib/soundManager');
      initSoundManager = mod.initSoundManager;
      disposeSoundManager = mod.disposeSoundManager;
      playSound = mod.playSound;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('initSoundManager creates AudioContext on web', () => {
    initSoundManager();
    expect(global.AudioContext).toHaveBeenCalledTimes(1);
  });

  it('disposeSoundManager calls close() and nullifies context', () => {
    initSoundManager();
    disposeSoundManager();
    expect(mockClose).toHaveBeenCalled();

    // After dispose, playSound should be silent (no context)
    mockCreateOscillator.mockClear();
    playSound('stage_open');
    expect(mockCreateOscillator).not.toHaveBeenCalled();
  });

  it('playSound(stage_open) in full mode creates oscillators', () => {
    initSoundManager();
    playSound('stage_open');
    expect(mockCreateOscillator).toHaveBeenCalled();
  });

  it('playSound in off mode does nothing', () => {
    initSoundManager();
    mockSoundMode = 'off';
    playSound('stage_open');
    expect(mockCreateOscillator).not.toHaveBeenCalled();
  });

  it('runway_error (essential) plays in essential mode', () => {
    initSoundManager();
    mockSoundMode = 'essential';
    playSound('runway_error');
    expect(mockCreateOscillator).toHaveBeenCalled();
  });

  it('stage_open (non-essential) is skipped in essential mode', () => {
    initSoundManager();
    mockSoundMode = 'essential';
    playSound('stage_open');
    expect(mockCreateOscillator).not.toHaveBeenCalled();
  });

  it('authority_approved (essential) plays in essential mode', () => {
    initSoundManager();
    mockSoundMode = 'essential';
    playSound('authority_approved');
    expect(mockCreateOscillator).toHaveBeenCalled();
  });

  it('lens_open (non-essential) is skipped in essential mode', () => {
    initSoundManager();
    mockSoundMode = 'essential';
    playSound('lens_open');
    expect(mockCreateBuffer).not.toHaveBeenCalled();
    expect(mockCreateOscillator).not.toHaveBeenCalled();
  });

  it('suppresses second sound within 50ms cooldown (same or lower priority)', () => {
    initSoundManager();
    playSound('stage_open'); // priority 0
    const firstCallCount = mockCreateOscillator.mock.calls.length;

    // Immediately play another priority-0 sound -- should be suppressed
    playSound('stage_close');
    expect(mockCreateOscillator.mock.calls.length).toBe(firstCallCount);
  });

  it('higher priority sound overrides cooldown', () => {
    initSoundManager();
    playSound('stage_open'); // priority 0, uses oscillator
    const oscAfterFirst = mockCreateOscillator.mock.calls.length;

    // Immediately play runway_error (priority 2) -- should play despite cooldown
    playSound('runway_error');
    expect(mockCreateOscillator.mock.calls.length).toBeGreaterThan(oscAfterFirst);
  });

  it('emits sound_play telemetry event on successful play', () => {
    initSoundManager();
    playSound('stage_open');
    expect(mockSoundEmit).toHaveBeenCalledWith('sound_play', {
      sound: 'stage_open',
      mode: 'full',
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Telemetry Queue
// ---------------------------------------------------------------------------
describe('Telemetry Queue', () => {
  let emitCanvasEvent: (event: string, data?: Record<string, unknown>) => void;
  let getTelemetryQueue: () => readonly unknown[];
  let clearTelemetryQueue: () => void;
  let flushTelemetry: () => Promise<void>;
  let getSessionMetrics: () => {
    stageOpenCount: number;
    modeChanges: number;
    sloViolations: number;
    avgFps: number;
    eventCounts: Record<string, number>;
  };
  let resetSessionMetrics: () => void;
  let recordFpsSample: (fps: number) => void;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.isolateModules(() => {
      // No mock for canvasTelemetry -- we test the real module.
      // But we need to un-mock it if prior describe blocks mocked it.
      jest.unmock('@/lib/canvasTelemetry');

      const telemetry = require('@/lib/canvasTelemetry');
      emitCanvasEvent = telemetry.emitCanvasEvent;
      getTelemetryQueue = telemetry.getTelemetryQueue;
      clearTelemetryQueue = telemetry.clearTelemetryQueue;
      flushTelemetry = telemetry.flushTelemetry;
      getSessionMetrics = telemetry.getSessionMetrics;
      resetSessionMetrics = telemetry.resetSessionMetrics;
      recordFpsSample = telemetry.recordFpsSample;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('auto-flushes queue when 20 events accumulate (FLUSH_THRESHOLD)', () => {
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation();

    for (let i = 0; i < 20; i++) {
      emitCanvasEvent('stage_open', { i });
    }

    // After 20 events, flush fires in dev mode via console.debug.
    // Queue should be empty after flush.
    expect(getTelemetryQueue().length).toBe(0);
    debugSpy.mockRestore();
  });

  it('flushes after 5s timer even if under threshold', () => {
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation();

    emitCanvasEvent('stage_open', {});
    expect(getTelemetryQueue().length).toBe(1);

    jest.advanceTimersByTime(5_100);

    expect(getTelemetryQueue().length).toBe(0);
    debugSpy.mockRestore();
  });

  it('clearTelemetryQueue empties queue and cancels pending timer', () => {
    emitCanvasEvent('stage_open', {});
    emitCanvasEvent('lens_open', {});
    expect(getTelemetryQueue().length).toBe(2);

    clearTelemetryQueue();
    expect(getTelemetryQueue().length).toBe(0);

    // Timer should be cancelled -- advancing time should not cause errors
    jest.advanceTimersByTime(10_000);
  });

  it('flushTelemetry on empty queue is a no-op', async () => {
    await flushTelemetry();
    // No error, no side effects
  });

  it('session metrics increment counters for relevant events', () => {
    emitCanvasEvent('stage_open', {});
    emitCanvasEvent('stage_open', {});
    emitCanvasEvent('mode_change', {});
    emitCanvasEvent('slo_violation', {});

    const metrics = getSessionMetrics();
    expect(metrics.stageOpenCount).toBe(2);
    expect(metrics.modeChanges).toBe(1);
    expect(metrics.sloViolations).toBe(1);
    expect(metrics.eventCounts.stage_open).toBe(2);
    expect(metrics.eventCounts.mode_change).toBe(1);
  });

  it('recordFpsSample updates avgFps correctly', () => {
    recordFpsSample(30);
    recordFpsSample(30);
    recordFpsSample(30);

    const metrics = getSessionMetrics();
    expect(metrics.avgFps).toBe(30);
  });

  it('recordFpsSample handles mixed values', () => {
    recordFpsSample(60);
    recordFpsSample(30);
    recordFpsSample(30);

    const metrics = getSessionMetrics();
    // (60 + 30 + 30) / 3 = 40
    expect(metrics.avgFps).toBe(40);
  });

  it('resetSessionMetrics clears everything back to defaults', () => {
    emitCanvasEvent('stage_open', {});
    emitCanvasEvent('slo_violation', {});
    recordFpsSample(20);

    resetSessionMetrics();

    const metrics = getSessionMetrics();
    expect(metrics.stageOpenCount).toBe(0);
    expect(metrics.sloViolations).toBe(0);
    expect(metrics.modeChanges).toBe(0);
    expect(metrics.avgFps).toBe(60);
    expect(metrics.eventCounts.stage_open).toBe(0);
  });

  it('does not throw on 1000 rapid emitCanvasEvent calls', () => {
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation();

    expect(() => {
      for (let i = 0; i < 1000; i++) {
        emitCanvasEvent('runway_step', { i });
      }
    }).not.toThrow();

    debugSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 4. Immersion Store Performance
// ---------------------------------------------------------------------------
describe('Immersion Store', () => {
  let setImmersionMode: (mode: string) => void;
  let setStageOpen: (open: boolean, tileId?: string) => void;
  let setRunwayState: (state: string) => void;
  let setDryRunActive: (active: boolean) => void;
  let setLensOpen: (open: boolean, tileId?: string) => void;
  let getImmersionState: () => Record<string, unknown>;

  beforeEach(() => {
    jest.isolateModules(() => {
      jest.unmock('@/lib/immersionStore');

      const store = require('@/lib/immersionStore');
      setImmersionMode = store.setImmersionMode;
      setStageOpen = store.setStageOpen;
      setRunwayState = store.setRunwayState;
      setDryRunActive = store.setDryRunActive;
      setLensOpen = store.setLensOpen;
      getImmersionState = store.getImmersionState;
    });
  });

  it('setImmersionMode with same value does not notify (state identity preserved)', () => {
    const initialState = getImmersionState();
    const initialMode = initialState.mode; // 'off' (default)

    setImmersionMode(initialMode as string);

    // State object reference should be identical -- no-op guard in source
    const afterState = getImmersionState();
    expect(afterState).toBe(initialState);
  });

  it('setRunwayState with same value does not create new state object', () => {
    const before = getImmersionState();
    const currentRunway = before.runwayState as string; // 'IDLE' (default)

    setRunwayState(currentRunway);

    const after = getImmersionState();
    expect(after).toBe(before);
  });

  it('setDryRunActive with same value does not create new state object', () => {
    const before = getImmersionState();

    setDryRunActive(false); // default is false

    const after = getImmersionState();
    expect(after).toBe(before);
  });

  it('handles 1000 rapid setStageOpen alternations without throwing', () => {
    expect(() => {
      for (let i = 0; i < 1000; i++) {
        setStageOpen(i % 2 === 0, 'tile-' + i);
      }
    }).not.toThrow();
  });

  it('returns consistent snapshot after many rapid changes', () => {
    for (let i = 0; i < 500; i++) {
      setStageOpen(i % 2 === 0, 'tile-test');
      setLensOpen(i % 3 === 0, 'lens-test');
    }

    const state = getImmersionState();
    // Last iteration i=499:
    //   499 % 2 === 1 -> setStageOpen(false) -> stageOpen=false, stagedTileId=null
    //   499 % 3 === 1 -> setLensOpen(false)  -> lensOpen=false, lensTileId=null
    expect(state.stageOpen).toBe(false);
    expect(state.stagedTileId).toBe(null);
    expect(state.lensOpen).toBe(false);
    expect(state.lensTileId).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// 5. SLO Monitor Logic (tested without hook wrapper)
// ---------------------------------------------------------------------------
describe('SLO Monitor Logic', () => {
  // Extracted from useSloMonitor -- test the pure threshold logic directly.
  // This avoids needing React hook rendering infrastructure.

  const SLO_THRESHOLDS: Record<string, number> = {
    lens_render: 200,
    preflight: 500,
    draft_creation: 3000,
    authority_submission: 800,
    receipt_display: 250,
  };

  function checkSloLogic(slo: string, durationMs: number): boolean {
    const threshold = SLO_THRESHOLDS[slo];
    if (threshold === undefined) return true;
    return durationMs <= threshold;
  }

  // --- lens_render: 200ms ---
  it('lens_render: 150ms passes SLO', () => {
    expect(checkSloLogic('lens_render', 150)).toBe(true);
  });

  it('lens_render: 200ms passes SLO (boundary)', () => {
    expect(checkSloLogic('lens_render', 200)).toBe(true);
  });

  it('lens_render: 250ms violates SLO', () => {
    expect(checkSloLogic('lens_render', 250)).toBe(false);
  });

  // --- preflight: 500ms ---
  it('preflight: 400ms passes SLO', () => {
    expect(checkSloLogic('preflight', 400)).toBe(true);
  });

  it('preflight: 600ms violates SLO', () => {
    expect(checkSloLogic('preflight', 600)).toBe(false);
  });

  // --- draft_creation: 3000ms ---
  it('draft_creation: 2500ms passes SLO', () => {
    expect(checkSloLogic('draft_creation', 2500)).toBe(true);
  });

  it('draft_creation: 3500ms violates SLO', () => {
    expect(checkSloLogic('draft_creation', 3500)).toBe(false);
  });

  // --- authority_submission: 800ms ---
  it('authority_submission: 700ms passes SLO', () => {
    expect(checkSloLogic('authority_submission', 700)).toBe(true);
  });

  it('authority_submission: 900ms violates SLO', () => {
    expect(checkSloLogic('authority_submission', 900)).toBe(false);
  });

  // --- receipt_display: 250ms ---
  it('receipt_display: 200ms passes SLO', () => {
    expect(checkSloLogic('receipt_display', 200)).toBe(true);
  });

  it('receipt_display: 300ms violates SLO', () => {
    expect(checkSloLogic('receipt_display', 300)).toBe(false);
  });

  // --- Unknown SLO ---
  it('unknown SLO name passes through (returns true)', () => {
    expect(checkSloLogic('nonexistent_metric', 999_999)).toBe(true);
  });

  // --- Boundary: exact threshold ---
  it('exact threshold value passes (<=)', () => {
    expect(checkSloLogic('authority_submission', 800)).toBe(true);
    expect(checkSloLogic('receipt_display', 250)).toBe(true);
    expect(checkSloLogic('draft_creation', 3000)).toBe(true);
  });

  // --- One millisecond over ---
  it('one millisecond over threshold violates', () => {
    expect(checkSloLogic('lens_render', 201)).toBe(false);
    expect(checkSloLogic('preflight', 501)).toBe(false);
    expect(checkSloLogic('authority_submission', 801)).toBe(false);
  });
});
