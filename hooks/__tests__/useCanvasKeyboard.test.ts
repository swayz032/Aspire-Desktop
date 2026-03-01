/**
 * useCanvasKeyboard.test.ts -- Unit tests for Canvas Keyboard Navigation (Wave 20)
 *
 * Tests cover:
 * - Delete/Backspace key handling
 * - Escape key handling
 * - Arrow key navigation (up/down/left/right)
 * - Enter key activation
 * - Input field exclusion (no interference with text inputs)
 * - Modifier key guards (Cmd+Backspace, Ctrl+Enter, etc.)
 * - Enabled/disabled toggle
 * - Cleanup on unmount
 *
 * Note: jest-expo does not provide window.addEventListener by default.
 * We set up a minimal window mock with event listener support.
 */

import { renderHook } from '@testing-library/react-native';
import { useCanvasKeyboard, type CanvasKeyboardHandlers } from '../useCanvasKeyboard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// Set up window.addEventListener/removeEventListener for keyboard events
type KeydownListener = (e: KeyboardEvent) => void;
const keydownListeners: Set<KeydownListener> = new Set();

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
globalThis.window = globalThis.window ?? ({} as typeof globalThis.window);
(window as unknown as Record<string, unknown>).addEventListener = jest.fn((event: string, listener: KeydownListener) => {
  if (event === 'keydown') {
    keydownListeners.add(listener);
  }
});
(window as unknown as Record<string, unknown>).removeEventListener = jest.fn((event: string, listener: KeydownListener) => {
  if (event === 'keydown') {
    keydownListeners.delete(listener);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createHandlers(): CanvasKeyboardHandlers {
  return {
    onDelete: jest.fn(),
    onEscape: jest.fn(),
    onArrowMove: jest.fn(),
    onEnter: jest.fn(),
  };
}

/**
 * Dispatch a keydown event to all registered listeners.
 * Simulates a normal (non-input) target by default.
 */
function fireKeyDown(
  key: string,
  options: { metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean } = {},
): void {
  const event = {
    key,
    metaKey: options.metaKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    altKey: options.altKey ?? false,
    target: { tagName: 'DIV', isContentEditable: false },
    preventDefault: jest.fn(),
  } as unknown as KeyboardEvent;

  keydownListeners.forEach((listener) => listener(event));
}

/**
 * Dispatch a keydown event from a specific element type (INPUT, TEXTAREA, etc.).
 */
function fireKeyDownFromInput(
  key: string,
  tagName: string,
  isContentEditable = false,
): void {
  const event = {
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    target: { tagName, isContentEditable },
    preventDefault: jest.fn(),
  } as unknown as KeyboardEvent;

  keydownListeners.forEach((listener) => listener(event));
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  keydownListeners.clear();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests: Delete/Backspace
// ---------------------------------------------------------------------------

describe('Delete/Backspace key', () => {
  it('calls onDelete when Delete is pressed', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers));

    fireKeyDown('Delete');
    expect(handlers.onDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when Backspace is pressed', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers));

    fireKeyDown('Backspace');
    expect(handlers.onDelete).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onDelete when Cmd+Backspace is pressed', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers));

    fireKeyDown('Backspace', { metaKey: true });
    expect(handlers.onDelete).not.toHaveBeenCalled();
  });

  it('does NOT call onDelete when Ctrl+Delete is pressed', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers));

    fireKeyDown('Delete', { ctrlKey: true });
    expect(handlers.onDelete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: Escape
// ---------------------------------------------------------------------------

describe('Escape key', () => {
  it('calls onEscape when Escape is pressed', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers));

    fireKeyDown('Escape');
    expect(handlers.onEscape).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: Arrow Keys
// ---------------------------------------------------------------------------

describe('Arrow keys', () => {
  it('calls onArrowMove("up") on ArrowUp', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers));

    fireKeyDown('ArrowUp');
    expect(handlers.onArrowMove).toHaveBeenCalledWith('up');
  });

  it('calls onArrowMove("down") on ArrowDown', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers));

    fireKeyDown('ArrowDown');
    expect(handlers.onArrowMove).toHaveBeenCalledWith('down');
  });

  it('calls onArrowMove("left") on ArrowLeft', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers));

    fireKeyDown('ArrowLeft');
    expect(handlers.onArrowMove).toHaveBeenCalledWith('left');
  });

  it('calls onArrowMove("right") on ArrowRight', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers));

    fireKeyDown('ArrowRight');
    expect(handlers.onArrowMove).toHaveBeenCalledWith('right');
  });
});

// ---------------------------------------------------------------------------
// Tests: Enter
// ---------------------------------------------------------------------------

describe('Enter key', () => {
  it('calls onEnter when Enter is pressed', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers));

    fireKeyDown('Enter');
    expect(handlers.onEnter).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onEnter when Cmd+Enter is pressed', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers));

    fireKeyDown('Enter', { metaKey: true });
    expect(handlers.onEnter).not.toHaveBeenCalled();
  });

  it('does NOT call onEnter when Ctrl+Enter is pressed', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers));

    fireKeyDown('Enter', { ctrlKey: true });
    expect(handlers.onEnter).not.toHaveBeenCalled();
  });

  it('does NOT call onEnter when Alt+Enter is pressed', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers));

    fireKeyDown('Enter', { altKey: true });
    expect(handlers.onEnter).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: Input Field Exclusion
// ---------------------------------------------------------------------------

describe('input field exclusion', () => {
  it('ignores keystrokes when INPUT is focused', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers));

    fireKeyDownFromInput('Delete', 'INPUT');
    expect(handlers.onDelete).not.toHaveBeenCalled();
  });

  it('ignores keystrokes when TEXTAREA is focused', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers));

    fireKeyDownFromInput('Backspace', 'TEXTAREA');
    expect(handlers.onDelete).not.toHaveBeenCalled();
  });

  it('ignores keystrokes when SELECT is focused', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers));

    fireKeyDownFromInput('ArrowDown', 'SELECT');
    expect(handlers.onArrowMove).not.toHaveBeenCalled();
  });

  it('ignores keystrokes in contentEditable elements', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers));

    fireKeyDownFromInput('Enter', 'DIV', true);
    expect(handlers.onEnter).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: Enabled/Disabled Toggle
// ---------------------------------------------------------------------------

describe('enabled option', () => {
  it('does not attach listener when disabled', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers, { enabled: false }));

    fireKeyDown('Delete');
    expect(handlers.onDelete).not.toHaveBeenCalled();
  });

  it('attaches listener when enabled', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers, { enabled: true }));

    fireKeyDown('Delete');
    expect(handlers.onDelete).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: Cleanup
// ---------------------------------------------------------------------------

describe('cleanup', () => {
  it('removes event listener on unmount', () => {
    const handlers = createHandlers();
    const { unmount } = renderHook(() => useCanvasKeyboard(handlers));

    expect(keydownListeners.size).toBe(1);

    unmount();

    expect(keydownListeners.size).toBe(0);

    // Firing after unmount should not call handler
    fireKeyDown('Delete');
    expect(handlers.onDelete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: Unknown Keys
// ---------------------------------------------------------------------------

describe('unknown keys', () => {
  it('ignores unhandled keys', () => {
    const handlers = createHandlers();
    renderHook(() => useCanvasKeyboard(handlers));

    fireKeyDown('a');
    fireKeyDown('Tab');
    fireKeyDown('Shift');
    fireKeyDown('F1');

    expect(handlers.onDelete).not.toHaveBeenCalled();
    expect(handlers.onEscape).not.toHaveBeenCalled();
    expect(handlers.onArrowMove).not.toHaveBeenCalled();
    expect(handlers.onEnter).not.toHaveBeenCalled();
  });
});
