/**
 * Shared fixtures for the tablet Playwright suite.
 *
 * Extracted to one place so a future change to the auth token format /
 * project ref / storage key only needs editing in a single file. Was
 * previously duplicated verbatim across smoke.spec.ts and hubs.spec.ts;
 * release-sre PRR-lite flagged the duplication as a maintenance hazard.
 *
 * Usage:
 *   import { injectAuthIfAvailable, isOnLoginRedirect } from './fixtures';
 */

import type { Page } from '@playwright/test';

/**
 * Inject a Supabase access token into localStorage so authenticated routes
 * render their real content instead of redirecting to /login.
 *
 * Reads token + refresh + project ref from environment variables. If
 * `E2E_SUPABASE_TOKEN` is unset, the function is a no-op -- the page will
 * redirect to /login on its first authenticated route, and tests should
 * call `isOnLoginRedirect()` to short-circuit assertions that depend on
 * the actual screen rendering.
 *
 * Env vars:
 *   E2E_SUPABASE_TOKEN          (required to enable auth) JWT access token
 *   E2E_SUPABASE_REFRESH        (optional) refresh token; falls back to access token
 *   E2E_SUPABASE_PROJECT_REF    (optional) project ref for the storage key; default 'aspire'
 */
export async function injectAuthIfAvailable(page: Page, baseURL: string): Promise<void> {
  const token = process.env.E2E_SUPABASE_TOKEN;
  if (!token) return;

  const refresh = process.env.E2E_SUPABASE_REFRESH ?? token;
  const projectRef = process.env.E2E_SUPABASE_PROJECT_REF ?? 'aspire';
  const storageKey = `sb-${projectRef}-auth-token`;

  // Navigate to origin first so localStorage is accessible on the correct domain.
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ key, value }: { key: string; value: string }) => {
      localStorage.setItem(key, value);
    },
    {
      key: storageKey,
      value: JSON.stringify({
        access_token: token,
        refresh_token: refresh,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    },
  );
}

/**
 * Returns true when the page has redirected to /login -- typically because
 * `injectAuthIfAvailable` was a no-op (no E2E_SUPABASE_TOKEN env var set).
 * Use to skip assertions that require the authenticated screen to render.
 */
export async function isOnLoginRedirect(page: Page): Promise<boolean> {
  return page.url().includes('/login');
}
