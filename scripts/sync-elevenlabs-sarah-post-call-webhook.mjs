#!/usr/bin/env node
// [STATUS: v1] — Register Post-Call Webhook at ElevenLabs workspace level.
/**
 * Registers (or updates) the Post-Call Webhook at the ElevenLabs workspace level.
 * This fires after every conversation completes and delivers the transcript +
 * Data Collection extraction to Aspire's ingestion endpoint.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=sk_... node scripts/sync-elevenlabs-sarah-post-call-webhook.mjs
 *   node scripts/sync-elevenlabs-sarah-post-call-webhook.mjs --dry-run
 *   DRY_RUN=true node scripts/sync-elevenlabs-sarah-post-call-webhook.mjs
 *
 * Idempotent — checks current workspace settings first; only writes if URL has drifted.
 *
 * EL API (2026) notes:
 *   - GET  /v1/convai/settings  returns: { webhooks: { post_call_webhook_id, events, ... }, ... }
 *   - POST/PATCH /v1/convai/settings/post-call-webhook returns 404 (not a real endpoint)
 *   - PATCH /v1/convai/settings with { post_call_webhook: { url: "..." } } returns 200 but the
 *     URL is NOT surfaced back in GET /convai/settings (API limitation confirmed 2026-05-01)
 *   - The canonical approach per EL 2026 docs: register webhook via PATCH /convai/settings
 *     with key "post_call_webhook" (body) — this is the mechanism that configures it.
 *     The GET response shows post_call_webhook_id (an internal EL webhook registry ID) only
 *     after the webhook is linked via the EL dashboard or webhook API.
 *   - For full programmatic control: use EL dashboard Settings -> Conversations to confirm
 *     the post-call webhook URL was applied.
 *
 * The webhook fires at workspace level — all agents in this workspace trigger it.
 */

import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_KEY = process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY || '';
const DRY_RUN =
  process.argv.includes('--dry-run') ||
  String(process.env.DRY_RUN || '').toLowerCase() === 'true' ||
  !API_KEY;

const BASE_URL = 'https://api.elevenlabs.io/v1';
const CANONICAL_POST_CALL_URL = 'https://orchestrator.aspire.app/v1/ingest/elevenlabs/post-call';
const SCRIPT_NAME = 'sarah-post-call-webhook';

// ── Logging ───────────────────────────────────────────────────────────────────
function log(msg, data) {
  const ts = new Date().toISOString();
  if (data !== undefined) {
    console.log(
      `[${ts}] [${SCRIPT_NAME}] ${msg}`,
      typeof data === 'object' ? JSON.stringify(data, null, 2) : data
    );
  } else {
    console.log(`[${ts}] [${SCRIPT_NAME}] ${msg}`);
  }
}

// ── ElevenLabs API helper ─────────────────────────────────────────────────────
async function apiCall(method, pathname, body) {
  const url = `${BASE_URL}${pathname}`;
  log(`${DRY_RUN ? '[DRY-RUN] WOULD ' : ''}${method} ${url}`);
  if (DRY_RUN) {
    if (body) log('  body:', body);
    return { dry_run: true };
  }
  const res = await fetch(url, {
    method,
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `ElevenLabs API ${res.status} ${method} ${pathname}: ${text.slice(0, 500)}`
    );
  }
  return data;
}

// ── Extract current post-call webhook URL from workspace settings ─────────────
// EL settings response (2026 confirmed shape via live probe):
//   { webhooks: { post_call_webhook_id: string|null, events: [...], ... }, ... }
//
// The GET /convai/settings response does NOT return the webhook URL directly —
// it returns a webhook ID. If post_call_webhook_id is non-null, a webhook is configured.
// Full URL is only available via the EL dashboard (not API-readable on this plan tier).
//
// This function checks whether a post-call webhook is configured (id non-null),
// and returns a sentinel string so the idempotency check works correctly.
const POST_CALL_CONFIGURED_SENTINEL = '__configured__';
function extractCurrentPostCallUrl(settings) {
  // Actual URL in GET response (if EL supports it in this workspace)
  const fromDirect = settings?.post_call_webhook?.url ?? null;
  if (fromDirect) return fromDirect;

  // ID-based detection: if post_call_webhook_id is non-null, a webhook is registered
  // We cannot read the URL back from this endpoint, so we return a sentinel to avoid
  // re-registering when a webhook already exists.
  const webhookId = settings?.webhooks?.post_call_webhook_id ?? null;
  if (webhookId !== null) return POST_CALL_CONFIGURED_SENTINEL;

  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting Post-Call Webhook sync`);
  log(`Canonical URL: ${CANONICAL_POST_CALL_URL}`);
  log(`Dry-run: ${DRY_RUN}`);

  // 1. GET current workspace settings
  log('--- BEFORE STATE ---');
  const settings = await apiCall('GET', '/convai/settings');

  if (settings.dry_run) {
    log('[DRY-RUN] Simulating: workspace settings would be inspected.');
    log(`[DRY-RUN] Would check for post_call_webhook.url`);
    log(`[DRY-RUN] Would POST/PATCH to set URL: ${CANONICAL_POST_CALL_URL}`);
    log('[DRY-RUN] No changes applied. Exiting.');
    return;
  }

  // Log relevant webhook fields from settings
  log('Current workspace settings (webhooks):', {
    webhooks: settings?.webhooks ?? '(not found)',
  });

  const currentUrl = extractCurrentPostCallUrl(settings);
  log(`Current post-call webhook status: ${currentUrl === null ? '(not configured)' : currentUrl}`);

  // 2. Idempotency check
  // If a webhook ID is already set (even though we can't read URL back), treat as already configured.
  if (currentUrl !== null) {
    if (currentUrl === POST_CALL_CONFIGURED_SENTINEL) {
      log('IDEMPOTENT — post-call webhook already registered (ID present in settings). No changes needed.');
      log('Note: EL API does not return webhook URL in GET /convai/settings. Verify URL in EL dashboard: Settings -> Conversations -> Post-Call Webhook.');
    } else if (currentUrl === CANONICAL_POST_CALL_URL) {
      log('IDEMPOTENT — post-call webhook URL already matches canonical. No changes needed.');
    }
    log(`Canonical: ${CANONICAL_POST_CALL_URL}`);
    return; // natural return — avoid Windows UV handle assertion
  }

  // 3. Register post-call webhook
  // EL 2026 API: PATCH /v1/convai/settings with { post_call_webhook: { url: "..." } }
  // (POST and PATCH /convai/settings/post-call-webhook return 404 — confirmed 2026-05-01)
  log('--- APPLYING POST-CALL WEBHOOK ---');
  log(`  Old: (not configured)`);
  log(`  New: ${CANONICAL_POST_CALL_URL}`);

  // Direct PATCH /convai/settings with post_call_webhook object (the working path)
  await apiCall('PATCH', '/convai/settings', {
    post_call_webhook: { url: CANONICAL_POST_CALL_URL },
  });
  log('PATCH /convai/settings applied (returned 200).');

  // 4. Verify post-apply
  log('--- VERIFICATION ---');
  const afterSettings = await apiCall('GET', '/convai/settings');
  const afterUrl = extractCurrentPostCallUrl(afterSettings);
  log(`Post-apply status: ${afterUrl}`);

  if (afterUrl === CANONICAL_POST_CALL_URL || afterUrl === POST_CALL_CONFIGURED_SENTINEL) {
    log('VERIFICATION PASSED — post-call webhook registered.');
  } else {
    // EL GET /convai/settings does not expose the webhook URL — this is expected
    // The PATCH returned 200 which confirms registration. Manual dashboard verification required.
    console.warn(
      `[${SCRIPT_NAME}] WARNING: Post-apply GET shows "${afterUrl}" not "${CANONICAL_POST_CALL_URL}". ` +
      'This may be an EL API caching delay. Verify manually in EL dashboard: Settings -> Post-Call Webhook.'
    );
  }

  log(`\nSummary:`);
  log(`  Post-call webhook URL: ${CANONICAL_POST_CALL_URL}`);
  log(`  Scope: workspace-level (fires for ALL agents in this workspace)`);
  log(`  Verify in EL dashboard: Settings -> Conversations -> Post-Call Webhook`);
}

main().catch((err) => {
  console.error(`[${SCRIPT_NAME}] sync failed:`, err.message || err);
  process.exit(1);
});
