import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImmersionMode = 'off' | 'depth' | 'canvas';
export type SoundMode = 'off' | 'essential' | 'full';
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

export interface ImmersionState {
  mode: ImmersionMode;
  fpsMovingAvg: number;
  stageOpen: boolean;
  stagedTileId: string | null;
  runwayState: RunwayState;
  dryRunActive: boolean;
  soundMode: SoundMode;
  lensOpen: boolean;
  lensTileId: string | null;
  commandPaletteOpen: boolean;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_STATE: ImmersionState = {
  mode: 'off',
  fpsMovingAvg: 60,
  stageOpen: false,
  stagedTileId: null,
  runwayState: 'IDLE',
  dryRunActive: false,
  soundMode: 'essential',
  lensOpen: false,
  lensTileId: null,
  commandPaletteOpen: false,
};

// ---------------------------------------------------------------------------
// localStorage helpers (web only — persist mode + soundMode)
// ---------------------------------------------------------------------------

function storageKey(suiteId: string, officeNum: string): string {
  return `aspire_immersion_${suiteId}_${officeNum}`;
}

let activeSuiteId = '';
let activeOfficeNum = '';

interface PersistedFields {
  mode: ImmersionMode;
  soundMode: SoundMode;
}

function loadPersisted(): Partial<PersistedFields> {
  if (Platform.OS !== 'web') return {};
  if (!activeSuiteId || !activeOfficeNum) return {};

  try {
    const raw = localStorage.getItem(storageKey(activeSuiteId, activeOfficeNum));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const obj = parsed as Record<string, unknown>;
    const result: Partial<PersistedFields> = {};
    if (obj.mode === 'off' || obj.mode === 'depth' || obj.mode === 'canvas') {
      result.mode = obj.mode;
    }
    if (obj.soundMode === 'off' || obj.soundMode === 'essential' || obj.soundMode === 'full') {
      result.soundMode = obj.soundMode;
    }
    return result;
  } catch {
    return {};
  }
}

function savePersisted(mode: ImmersionMode, soundMode: SoundMode): void {
  if (Platform.OS !== 'web') return;
  if (!activeSuiteId || !activeOfficeNum) return;

  try {
    localStorage.setItem(
      storageKey(activeSuiteId, activeOfficeNum),
      JSON.stringify({ mode, soundMode }),
    );
  } catch {
    // silent — storage quota or private browsing
  }
}

// ---------------------------------------------------------------------------
// Module-level state + listener set (matches uiStore.ts pattern)
// ---------------------------------------------------------------------------

let state: ImmersionState = { ...DEFAULT_STATE };
const listeners = new Set<(s: ImmersionState) => void>();

function notify(): void {
  listeners.forEach((fn) => fn(state));
}

// ---------------------------------------------------------------------------
// Public API — getters / setters
// ---------------------------------------------------------------------------

export function getImmersionState(): ImmersionState {
  return state;
}

export function initImmersionScope(suiteId: string, officeNum: string): void {
  activeSuiteId = suiteId;
  activeOfficeNum = officeNum;
  const persisted = loadPersisted();
  state = { ...DEFAULT_STATE, ...persisted };
  notify();
}

export function setImmersionMode(mode: ImmersionMode): void {
  if (state.mode === mode) return;
  state = { ...state, mode };
  savePersisted(state.mode, state.soundMode);
  notify();
}

export function setStageOpen(open: boolean, tileId?: string): void {
  state = {
    ...state,
    stageOpen: open,
    stagedTileId: open ? (tileId ?? state.stagedTileId) : null,
  };
  notify();
}

export function setRunwayState(runwayState: RunwayState): void {
  if (state.runwayState === runwayState) return;
  state = { ...state, runwayState };
  notify();
}

export function setLensOpen(open: boolean, tileId?: string): void {
  state = {
    ...state,
    lensOpen: open,
    lensTileId: open ? (tileId ?? state.lensTileId) : null,
  };
  notify();
}

export function setDryRunActive(active: boolean): void {
  if (state.dryRunActive === active) return;
  state = { ...state, dryRunActive: active };
  notify();
}

export function setSoundMode(soundMode: SoundMode): void {
  if (state.soundMode === soundMode) return;
  state = { ...state, soundMode };
  savePersisted(state.mode, state.soundMode);
  notify();
}

export function setCommandPaletteOpen(open: boolean): void {
  if (state.commandPaletteOpen === open) return;
  state = { ...state, commandPaletteOpen: open };
  notify();
}

export function setFpsMovingAvg(fps: number): void {
  state = { ...state, fpsMovingAvg: fps };
  notify();
}

// ---------------------------------------------------------------------------
// React hook — subscribes to module-level state (matches uiStore pattern)
// ---------------------------------------------------------------------------

export function useImmersion(): ImmersionState {
  const [snapshot, setSnapshot] = useState<ImmersionState>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const persisted = loadPersisted();
      if (persisted.mode !== undefined || persisted.soundMode !== undefined) {
        state = { ...state, ...persisted };
      }
    }
    return state;
  });

  useEffect(() => {
    const listener = (next: ImmersionState) => {
      setSnapshot(next);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return snapshot;
}
