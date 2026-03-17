/**
 * Dev-only logging helpers. In production, these are silent.
 * Used by useAgentVoice and other hooks for debug output.
 */

const isDev = __DEV__ ?? process.env.NODE_ENV !== 'production';

export function devLog(...args: unknown[]): void {
  if (isDev) console.log('[Aspire]', ...args);
}

export function devWarn(...args: unknown[]): void {
  if (isDev) console.warn('[Aspire]', ...args);
}

export function devError(...args: unknown[]): void {
  console.error('[Aspire]', ...args);
}
