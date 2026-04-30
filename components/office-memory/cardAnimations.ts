/**
 * Office Memory keyframe injector — mirrors `components/finance/cardAnimations.ts`
 * pattern (web-only, idempotent, lazy). Keeps Memory Engine animations
 * decoupled from finance namespace so either side can evolve independently.
 *
 * Animations injected:
 *   - `memoryLedPulse` — ambient LED ring breathing (search bar). 2400ms.
 *   - `memoryShimmer` — skeleton loading shimmer for memory grid placeholders.
 *
 * Per plan §12.1: spring physics preferred, but ambient pulses are linear-CSS
 * keyframes since Reanimated drivers are ill-suited to long-running infinite
 * loops on web (they'd retain the JS thread).
 */
import { Platform } from 'react-native';

let injected = false;

export function injectMemoryKeyframes(): void {
  if (Platform.OS !== 'web' || injected) return;
  if (typeof document === 'undefined') return;
  injected = true;

  const style = document.createElement('style');
  style.id = 'memory-engine-keyframes';
  style.textContent = `
    @keyframes memoryLedPulse {
      0%, 100% {
        opacity: 0.35;
        box-shadow: 0 0 0 1px rgba(59,130,246,0.40), 0 0 18px 2px rgba(59,130,246,0.22);
      }
      50% {
        opacity: 0.78;
        box-shadow: 0 0 0 1px rgba(59,130,246,0.65), 0 0 28px 6px rgba(59,130,246,0.42);
      }
    }
    @keyframes memoryLedPulseFocus {
      0%, 100% {
        opacity: 0.85;
        box-shadow: 0 0 0 1px rgba(59,130,246,0.75), 0 0 32px 8px rgba(59,130,246,0.50);
      }
      50% {
        opacity: 1;
        box-shadow: 0 0 0 1.5px rgba(96,165,250,0.95), 0 0 44px 12px rgba(59,130,246,0.62);
      }
    }
    @keyframes memoryShimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @keyframes memoryFadeUp {
      0%   { opacity: 0; transform: translateY(8px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    .aspire-memory-card {
      transition: transform 180ms cubic-bezier(0.4, 0, 0.2, 1),
                  box-shadow 220ms cubic-bezier(0.4, 0, 0.2, 1),
                  border-color 220ms ease-out;
      /* Always-on subtle Aspire-blue glow — barely there but unmistakable.
         Per plan §19 Pass 13.E + user direction "soft subtle glow regardless,
         not loud." Intensifies on hover. */
      box-shadow: 0 0 0 1px rgba(59,130,246,0.18),
                  0 0 14px 0 rgba(59,130,246,0.12),
                  inset 0 1px 0 rgba(255,255,255,0.04);
    }
    .aspire-memory-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 0 0 1px rgba(59,130,246,0.45),
                  0 0 24px 4px rgba(59,130,246,0.30),
                  inset 0 1px 0 rgba(255,255,255,0.06);
    }
    .aspire-memory-card:active {
      transform: translateY(-1px);
      box-shadow: 0 0 0 1px rgba(59,130,246,0.55),
                  0 0 18px 2px rgba(59,130,246,0.32),
                  inset 0 1px 0 rgba(255,255,255,0.06);
    }
    .aspire-memory-bookmark {
      transition: background-color 160ms ease-out, transform 120ms ease-out;
    }
    .aspire-memory-bookmark:hover {
      background-color: rgba(255,255,255,0.10);
      transform: scale(1.06);
    }
    .aspire-memory-link {
      transition: color 140ms ease-out;
    }
    .aspire-memory-link:hover {
      color: #ffffff !important;
    }
  `;
  document.head.appendChild(style);
}
