/**
 * useAdvancedMode — Wave 18b contractor-simple toggle.
 *
 * Reads `?advanced=1` URL param. When false (default), every "hidden by default"
 * UI element should suppress itself. When true (admin / debug / Tonio), the
 * full chip set / truth chips / per-item drill-downs / technical details are
 * visible.
 *
 * Contract:
 *   - default `false` → simple contractor view (Plumber's Grandfather Standard)
 *   - `?advanced=1` → admin view with the full stack
 *
 * Persists across navigations because expo-router preserves search params on
 * route push. Use anywhere a component needs to gate behavior.
 *
 * Law #7: render-layer only. No side effects.
 */
import { useLocalSearchParams } from 'expo-router';

export function useAdvancedMode(): boolean {
  const params = useLocalSearchParams<{ advanced?: string | string[] }>();
  const raw = params?.advanced;
  if (raw == null) return false;
  // expo-router can return string OR string[] for repeated params
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === '1' || value === 'true';
}
