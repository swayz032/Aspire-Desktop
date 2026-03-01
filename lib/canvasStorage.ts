/**
 * Canvas Storage Service -- Tenant-scoped state persistence for Canvas Mode.
 *
 * Saves and restores widget positions, sizes, z-indices, and avatar positions
 * to localStorage with per-suite/office scoping (Law #6 tenant isolation).
 *
 * Patterns:
 * - Web-only localStorage (matches immersionStore.ts pattern)
 * - Debounced save (prevents excessive writes during drag — max 1 write / 500ms)
 * - Fail-safe: storage errors never break the app (silent catch)
 * - Version field for future schema migrations
 *
 * Wave 18 -- Canvas Mode state persistence.
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WidgetState {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface AvatarState {
  agent: 'ava' | 'finn' | 'eli';
  x: number;
  y: number;
}

export interface CanvasState {
  version: number;
  widgets: WidgetState[];
  avatars: AvatarState[];
  lastModified: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Current storage schema version */
const SCHEMA_VERSION = 1;

/** Default debounce delay (ms) */
const DEFAULT_DEBOUNCE_MS = 500;

/** Maximum number of widgets to persist (safety limit) */
const MAX_WIDGETS = 50;

/** Maximum number of avatars to persist (safety limit) */
const MAX_AVATARS = 10;

// ---------------------------------------------------------------------------
// Storage Key (tenant-scoped)
// ---------------------------------------------------------------------------

/**
 * Generate a localStorage key scoped to suite + office.
 * Matches immersionStore.ts convention: `aspire_{feature}_{suiteId}_{officeId}`
 */
function getStorageKey(suiteId: string, officeId: string): string {
  return `aspire_canvas_state_${suiteId}_${officeId}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isValidWidgetState(w: unknown): w is WidgetState {
  if (typeof w !== 'object' || w === null) return false;
  const obj = w as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    typeof obj.width === 'number' &&
    typeof obj.height === 'number' &&
    typeof obj.zIndex === 'number' &&
    isFinite(obj.x as number) &&
    isFinite(obj.y as number) &&
    isFinite(obj.width as number) &&
    isFinite(obj.height as number)
  );
}

function isValidAvatarState(a: unknown): a is AvatarState {
  if (typeof a !== 'object' || a === null) return false;
  const obj = a as Record<string, unknown>;
  return (
    (obj.agent === 'ava' || obj.agent === 'finn' || obj.agent === 'eli') &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    isFinite(obj.x as number) &&
    isFinite(obj.y as number)
  );
}

function parseAndValidate(raw: string): CanvasState | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const obj = parsed as Record<string, unknown>;

    // Check version
    if (typeof obj.version !== 'number' || obj.version !== SCHEMA_VERSION) {
      return null; // Incompatible version, discard
    }

    // Validate widgets array
    if (!Array.isArray(obj.widgets)) return null;
    const widgets: WidgetState[] = [];
    for (const w of obj.widgets) {
      if (isValidWidgetState(w)) {
        widgets.push(w);
      }
    }

    // Validate avatars array
    const avatars: AvatarState[] = [];
    if (Array.isArray(obj.avatars)) {
      for (const a of obj.avatars) {
        if (isValidAvatarState(a)) {
          avatars.push(a);
        }
      }
    }

    // Enforce safety limits
    const lastModified =
      typeof obj.lastModified === 'number' ? obj.lastModified : Date.now();

    return {
      version: SCHEMA_VERSION,
      widgets: widgets.slice(0, MAX_WIDGETS),
      avatars: avatars.slice(0, MAX_AVATARS),
      lastModified,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save canvas state to localStorage (web-only).
 * Silently no-ops on native platforms and on storage errors.
 */
export function saveCanvasState(
  suiteId: string,
  officeId: string,
  state: CanvasState,
): void {
  if (Platform.OS !== 'web') return;
  if (!suiteId || !officeId) return;

  try {
    const key = getStorageKey(suiteId, officeId);
    const data: CanvasState = {
      version: SCHEMA_VERSION,
      widgets: state.widgets.slice(0, MAX_WIDGETS),
      avatars: state.avatars.slice(0, MAX_AVATARS),
      lastModified: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // silent -- storage quota or private browsing
  }
}

/**
 * Load canvas state from localStorage (web-only).
 * Returns null if no saved state or if data is invalid.
 */
export function loadCanvasState(
  suiteId: string,
  officeId: string,
): CanvasState | null {
  if (Platform.OS !== 'web') return null;
  if (!suiteId || !officeId) return null;

  try {
    const key = getStorageKey(suiteId, officeId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return parseAndValidate(raw);
  } catch {
    return null;
  }
}

/**
 * Clear canvas state from localStorage (reset to default).
 */
export function clearCanvasState(
  suiteId: string,
  officeId: string,
): void {
  if (Platform.OS !== 'web') return;
  if (!suiteId || !officeId) return;

  try {
    const key = getStorageKey(suiteId, officeId);
    localStorage.removeItem(key);
  } catch {
    // silent
  }
}

// ---------------------------------------------------------------------------
// Debounced Save
// ---------------------------------------------------------------------------

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced save -- prevents excessive writes during continuous drag operations.
 * Only the last call within the delay window will actually persist.
 *
 * @param suiteId - Tenant suite identifier
 * @param officeId - Tenant office identifier
 * @param state - Canvas state to persist
 * @param delay - Debounce delay in ms (default 500ms)
 */
export function debouncedSaveCanvasState(
  suiteId: string,
  officeId: string,
  state: CanvasState,
  delay: number = DEFAULT_DEBOUNCE_MS,
): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    saveCanvasState(suiteId, officeId, state);
    saveTimer = null;
  }, delay);
}

/**
 * Cancel any pending debounced save. Useful on unmount cleanup.
 */
export function cancelPendingSave(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

/**
 * Flush any pending debounced save immediately (e.g., on page unload).
 */
export function flushPendingSave(
  suiteId: string,
  officeId: string,
  state: CanvasState,
): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  saveCanvasState(suiteId, officeId, state);
}

// ---------------------------------------------------------------------------
// Helpers (exported for tests)
// ---------------------------------------------------------------------------

export { getStorageKey, SCHEMA_VERSION, MAX_WIDGETS, MAX_AVATARS };
