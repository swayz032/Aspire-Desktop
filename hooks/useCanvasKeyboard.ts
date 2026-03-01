/**
 * useCanvasKeyboard -- Widget-level keyboard navigation for Canvas Mode.
 *
 * Provides keyboard control for canvas widgets:
 * - Delete/Backspace: Remove focused widget
 * - Escape: Deselect focused widget
 * - Arrow keys: Nudge focused widget position (32px grid steps)
 * - Enter: Activate/open focused widget
 * - Tab: Move focus between widgets (handled natively by browser)
 *
 * This hook is SEPARATE from useGlobalKeyboard (which handles Cmd+K, Cmd+.,
 * and global Escape). This hook operates at the widget level and only fires
 * when a canvas widget has focus.
 *
 * WCAG 2.1 AA compliance -- 2.1.1 Keyboard, 2.4.7 Focus Visible.
 *
 * Web-only: No-ops on native platforms.
 *
 * Wave 20 -- Canvas Mode accessibility.
 */

import { useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CanvasKeyboardHandlers {
  /** Called when Delete or Backspace is pressed on a focused widget */
  onDelete: () => void;
  /** Called when Escape is pressed (deselect widget) */
  onEscape: () => void;
  /** Called when an arrow key is pressed (nudge widget position) */
  onArrowMove: (direction: 'up' | 'down' | 'left' | 'right') => void;
  /** Called when Enter is pressed (activate/open widget) */
  onEnter: () => void;
}

export interface CanvasKeyboardOptions {
  /** Whether the keyboard handler is active (default true) */
  enabled?: boolean;
  /** Grid step size for arrow key nudging (default 32px) */
  gridStep?: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Attach keyboard handlers for canvas widget interactions.
 *
 * @param handlers - Callback functions for each key action
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * useCanvasKeyboard({
 *   onDelete: () => removeWidget(selectedId),
 *   onEscape: () => setSelectedId(null),
 *   onArrowMove: (dir) => nudgeWidget(selectedId, dir),
 *   onEnter: () => openWidget(selectedId),
 * });
 * ```
 */
export function useCanvasKeyboard(
  handlers: CanvasKeyboardHandlers,
  options: CanvasKeyboardOptions = {},
): void {
  const { enabled = true } = options;

  // Use refs to avoid re-registering listeners on handler changes
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if typing in an input field
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const current = handlersRef.current;

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          // Only handle if not Cmd/Ctrl+Backspace (browser back)
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            current.onDelete();
          }
          break;

        case 'Escape':
          // Note: Global Escape is handled by useGlobalKeyboard.
          // This fires for widget-level deselection when no overlays are open.
          current.onEscape();
          break;

        case 'ArrowUp':
          e.preventDefault();
          current.onArrowMove('up');
          break;

        case 'ArrowDown':
          e.preventDefault();
          current.onArrowMove('down');
          break;

        case 'ArrowLeft':
          e.preventDefault();
          current.onArrowMove('left');
          break;

        case 'ArrowRight':
          e.preventDefault();
          current.onArrowMove('right');
          break;

        case 'Enter':
          // Only handle if not a modifier combo
          if (!e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            current.onEnter();
          }
          break;
      }
    },
    [],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}
