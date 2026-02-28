import { useEffect } from 'react';
import { Platform } from 'react-native';
import {
  getImmersionState,
  setCommandPaletteOpen,
  setContextMenuOpen,
  setLensOpen,
  setStageOpen,
  setRunwayState,
} from '@/lib/immersionStore';
import { isActive } from '@/lib/runwayMachine';
import { emitCanvasEvent } from '@/lib/canvasTelemetry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;

  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if ((el as HTMLElement).isContentEditable) return true;

  return false;
}

function isExternalModalOpen(): boolean {
  // Check for known modals that should take priority over canvas shortcuts
  if (document.querySelector('[data-modal="settings-panel"]')) return true;
  if (document.querySelector('[data-modal="document-preview"]')) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Global keyboard shortcut handler for Canvas Mode.
 * Web-only side-effect hook — no return value.
 *
 * - Cmd/Ctrl+K: Toggle CommandPalette
 * - Escape: Close topmost overlay (CommandPalette > LiveLens > Stage)
 * - Cmd/Ctrl+.: Cancel active Runway
 */
export function useGlobalKeyboard(): void {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    function handleKeydown(e: KeyboardEvent): void {
      // Don't intercept when typing in inputs
      if (isInputFocused()) return;

      // Don't intercept when external modals are open
      if (isExternalModalOpen()) return;

      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + K — Toggle CommandPalette
      if (isMod && e.key === 'k') {
        e.preventDefault();
        const state = getImmersionState();
        if (state.mode === 'off') return; // Canvas must be active
        setCommandPaletteOpen(!state.commandPaletteOpen);
        if (!state.commandPaletteOpen) {
          emitCanvasEvent('command_palette_open', {});
        }
        return;
      }

      // Cmd/Ctrl + . — Cancel active Runway
      if (isMod && e.key === '.') {
        e.preventDefault();
        const state = getImmersionState();
        if (isActive(state.runwayState)) {
          setRunwayState('CANCELLED');
          emitCanvasEvent('runway_step', {
            from: state.runwayState,
            to: 'CANCELLED',
            event: 'CANCEL',
          });
        }
        return;
      }

      // Escape — Close topmost overlay (priority order)
      if (e.key === 'Escape') {
        const state = getImmersionState();
        if (state.mode === 'off') return;

        // Priority 1: CommandPalette
        if (state.commandPaletteOpen) {
          e.preventDefault();
          setCommandPaletteOpen(false);
          return;
        }

        // Priority 2: ContextMenu
        if (state.contextMenuOpen) {
          e.preventDefault();
          setContextMenuOpen(false);
          return;
        }

        // Priority 3: LiveLens
        if (state.lensOpen) {
          e.preventDefault();
          setLensOpen(false);
          emitCanvasEvent('lens_close', {});
          return;
        }

        // Priority 4: Stage
        if (state.stageOpen) {
          e.preventDefault();
          setStageOpen(false);
          emitCanvasEvent('stage_close', {});
          return;
        }
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, []);
}
