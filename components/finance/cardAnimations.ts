import { Platform } from 'react-native';

let injected = false;

export function injectCardKeyframes() {
  if (Platform.OS !== 'web' || injected) return;
  if (typeof document === 'undefined') return;
  injected = true;

  const style = document.createElement('style');
  style.id = 'finance-card-keyframes';
  style.textContent = `
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @keyframes ledPulse {
      0%, 100% { opacity: 0.3; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.05); }
    }
  `;
  document.head.appendChild(style);
}
