export function hasSupabaseWebConfig(): boolean {
  // IMPORTANT: Must use process.env.EXPO_PUBLIC_* directly — Metro only inlines
  // direct references, not parameter/variable indirection (env.EXPO_PUBLIC_*).
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url?.trim() && key?.trim());
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Localhost / loopback / explicit synthetic dev hostnames where the bypass
 * may activate. Anything outside this list MUST never see auth bypass —
 * misconfigured prod deploys without Supabase env vars would otherwise
 * become a wide-open dashboard.
 *
 * Security posture (Aspire Law #3 — fail closed):
 *   bypass = (env flag set)
 *          AND (Supabase web config NOT present)
 *          AND (running on a recognized localhost / dev-only hostname)
 *          AND (not on a production-looking origin like *.aspire.app, *.aspireos.app, *.railway.app, etc.)
 */
function _isDevOnlyHost(): boolean {
  if (typeof window === 'undefined' || !window.location) {
    // Native runtime (iOS/Android) — only allow when explicit synthetic flag set.
    return process.env.EXPO_PUBLIC_ASPIRE_SYNTHETIC_ENV === 'local-smoke';
  }
  const host = window.location.hostname.toLowerCase();
  // Explicit allowlist — any other host (real domain) MUST NOT bypass auth.
  const DEV_HOSTS = new Set<string>([
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
  ]);
  if (DEV_HOSTS.has(host)) return true;
  // Allow *.localhost (e.g. aspire.localhost via /etc/hosts overrides) but
  // explicitly DENY any production-looking suffix even on local dev.
  if (host.endsWith('.localhost')) return true;
  return false;
}

function _isProductionLookingOrigin(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  const host = window.location.hostname.toLowerCase();
  // Block obvious production / staging hosts even if env vars happen to enable bypass.
  return (
    host.endsWith('.aspire.app') ||
    host.endsWith('.aspireos.app') ||
    host.endsWith('.railway.app') ||
    host.endsWith('.up.railway.app') ||
    host.endsWith('.vercel.app') ||
    host.endsWith('.netlify.app') ||
    // Generic top-level domain check — any host that LOOKS like prod
    // (has a TLD beyond .localhost/.local) is treated as prod for this check.
    (/\.[a-z]{2,}$/i.test(host) && !host.endsWith('.localhost') && !host.endsWith('.local'))
  );
}

export function allowDevSupabaseBypass(): boolean {
  const explicitBypass = process.env.EXPO_PUBLIC_ALLOW_SUPABASE_BYPASS === 'true';
  if (!explicitBypass) return false;
  if (hasSupabaseWebConfig()) return false;
  // Hard fail-closed on any production-looking origin (Aspire Law #3).
  if (_isProductionLookingOrigin()) {
    if (typeof console !== 'undefined') {
      console.error(
        '[SECURITY] EXPO_PUBLIC_ALLOW_SUPABASE_BYPASS=true detected on production-looking origin %s — IGNORED. ' +
          'Configure EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY to authenticate properly.',
        typeof window !== 'undefined' ? window.location.hostname : 'unknown',
      );
    }
    return false;
  }
  // Only activate on recognized localhost / synthetic-dev hosts.
  return _isDevOnlyHost();
}

export function getSyntheticRuntime(): string {
  return process.env.EXPO_PUBLIC_ASPIRE_SYNTHETIC_ENV || '';
}

export function isLocalSyntheticAuthBypass(): boolean {
  return allowDevSupabaseBypass() && getSyntheticRuntime() === 'local-smoke';
}
