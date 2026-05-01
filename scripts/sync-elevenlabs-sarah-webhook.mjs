#!/usr/bin/env node
// [STATUS: v1] — Register Conversation Initiation Client Data Webhook on Sarah Receptionist.
/**
 * Sets the `conversation_initiation_client_data_webhook` URL on the live Sarah Receptionist
 * agent (agent_6501kp71h69jfqysgd055hemqhrq).
 *
 * Usage:
 *   ELEVENLABS_API_KEY=sk_... node scripts/sync-elevenlabs-sarah-webhook.mjs
 *   node scripts/sync-elevenlabs-sarah-webhook.mjs --dry-run
 *   DRY_RUN=true node scripts/sync-elevenlabs-sarah-webhook.mjs
 *
 * Idempotent — if the webhook URL is already set to the canonical value, exits 0 with no PATCH.
 *
 * CRITICAL CONSTRAINTS:
 *   - DO NOT touch built_in_tools.transfer_to_number — preserved via minimal-merge PATCH
 *   - PATCH only the sub-path that currently holds the webhook field; never blanket-replace top-level keys
 *   - Verifies post-PATCH by re-GETting and asserting URL matches
 *
 * Agent ID: agent_6501kp71h69jfqysgd055hemqhrq (Sarah Receptionist — external/Twilio/Workflow)
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
const AGENT_ID = 'agent_6501kp71h69jfqysgd055hemqhrq';
const CANONICAL_WEBHOOK_URL = 'https://orchestrator.aspire.app/v1/sarah/personalization';
const SCRIPT_NAME = 'sarah-webhook';

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

// ── Webhook path resolution ───────────────────────────────────────────────────
// The EL API may put the webhook at:
//   (a) platform_settings.workspace_overrides.conversation_initiation_client_data_webhook
//   (b) conversation_config.agent.conversation_initiation_client_data_webhook
// We inspect both paths and pick the one that's set, or default to (a).
function resolveCurrentWebhook(agentData) {
  const fromWorkspaceOverrides =
    agentData?.platform_settings?.workspace_overrides
      ?.conversation_initiation_client_data_webhook ?? null;
  const fromConversationConfig =
    agentData?.conversation_config?.agent
      ?.conversation_initiation_client_data_webhook ?? null;

  if (fromWorkspaceOverrides !== null) {
    return {
      location: 'platform_settings.workspace_overrides',
      current: fromWorkspaceOverrides,
    };
  }
  if (fromConversationConfig !== null) {
    return {
      location: 'conversation_config.agent',
      current: fromConversationConfig,
    };
  }
  // Neither path is set — default to workspace_overrides (canonical EL 2026 location)
  return {
    location: 'platform_settings.workspace_overrides',
    current: null,
  };
}

// ── Build minimal-merge PATCH body ───────────────────────────────────────────
// NEVER blanket-replace platform_settings or conversation_config top-level keys.
// We only touch the specific webhook sub-path.
//
// EL API (2026) requires the webhook field to be an object:
//   { url: string, method: "GET"|"POST", request_headers: {} }
// NOT a plain string URL. Confirmed via live API probe 2026-05-01.
function buildWebhookObject() {
  return {
    url: CANONICAL_WEBHOOK_URL,
    method: 'GET',
    request_headers: {},
  };
}

function buildPatchBody(location) {
  if (location === 'platform_settings.workspace_overrides') {
    return {
      platform_settings: {
        workspace_overrides: {
          conversation_initiation_client_data_webhook: buildWebhookObject(),
        },
      },
    };
  }
  // conversation_config.agent path
  return {
    conversation_config: {
      agent: {
        conversation_initiation_client_data_webhook: buildWebhookObject(),
      },
    },
  };
}

// ── Verify webhook post-PATCH ─────────────────────────────────────────────────
// Returns the .url string from the webhook object, or null if not set.
// EL API stores the webhook as an object { url, method, request_headers }.
function extractWebhookUrl(agentData, location) {
  let webhookObj = null;
  if (location === 'platform_settings.workspace_overrides') {
    webhookObj =
      agentData?.platform_settings?.workspace_overrides
        ?.conversation_initiation_client_data_webhook ?? null;
  } else {
    webhookObj =
      agentData?.conversation_config?.agent
        ?.conversation_initiation_client_data_webhook ?? null;
  }
  if (webhookObj === null) return null;
  // Handle both object shape (new) and plain string (legacy)
  if (typeof webhookObj === 'string') return webhookObj;
  return webhookObj?.url ?? null;
}

// ── Transfer rules safety check ──────────────────────────────────────────────
function verifyTransferRulesIntact(agentData, phase) {
  const builtInTools = agentData?.conversation_config?.agent?.built_in_tools;
  const transferRules =
    builtInTools?.transfer_to_number?.transfer_list ?? [];
  log(`${phase} transfer_to_number rule count: ${transferRules.length}`);
  if (!DRY_RUN && transferRules.length !== 5) {
    const msg = `WARNING: ${phase} transfer_to_number rule count is ${transferRules.length} (expected 5). Rules may have been modified externally.`;
    console.warn(`[${SCRIPT_NAME}] ${msg}`);
    // Warn but do not abort — Lane C policy is to observe, not touch
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting Conversation Initiation webhook sync for Sarah Receptionist (${AGENT_ID})`);
  log(`Canonical URL: ${CANONICAL_WEBHOOK_URL}`);
  log(`Dry-run: ${DRY_RUN}`);

  // 1. GET current state
  log('--- BEFORE STATE ---');
  const before = await apiCall('GET', `/convai/agents/${AGENT_ID}`);

  if (before.dry_run) {
    log('[DRY-RUN] Simulating: webhook URL would be inspected and set to canonical URL.');
    log('[DRY-RUN] Location: platform_settings.workspace_overrides.conversation_initiation_client_data_webhook');
    log('[DRY-RUN] Old value: (unknown — not fetched in dry-run)');
    log(`[DRY-RUN] New value: ${CANONICAL_WEBHOOK_URL}`);
    log('[DRY-RUN] transfer_to_number rules: would verify count == 5');
    log('[DRY-RUN] No changes applied. Exiting.');
    return;
  }

  // 2. Resolve location + current URL value
  const { location, current: currentObj } = resolveCurrentWebhook(before);
  // Normalize: extract URL string from object or null
  const currentUrl =
    currentObj === null
      ? null
      : typeof currentObj === 'string'
      ? currentObj
      : currentObj?.url ?? null;

  log(`Webhook location: ${location}`);
  log(`Current webhook URL: ${currentUrl === null ? '(not set)' : currentUrl}`);

  verifyTransferRulesIntact(before, 'BEFORE');

  // 3. Idempotency check
  if (currentUrl === CANONICAL_WEBHOOK_URL) {
    log('IDEMPOTENT — webhook URL already matches canonical. No changes needed.');
    log(`Verified: ${CANONICAL_WEBHOOK_URL}`);
    return; // natural return — no process.exit() to avoid Windows UV handle assertions
  }

  // 4. PATCH minimal-merge sub-path only
  log('--- APPLYING PATCH ---');
  log(`  Old: ${currentUrl === null ? '(empty)' : currentUrl}`);
  log(`  New: ${CANONICAL_WEBHOOK_URL}`);

  const patchBody = buildPatchBody(location);
  await apiCall('PATCH', `/convai/agents/${AGENT_ID}`, patchBody);
  log('PATCH applied.');

  // 5. Verify post-PATCH
  log('--- VERIFICATION ---');
  const after = await apiCall('GET', `/convai/agents/${AGENT_ID}`);
  const afterValue = extractWebhookUrl(after, location);
  log(`Post-PATCH webhook URL: ${afterValue}`);

  verifyTransferRulesIntact(after, 'AFTER');

  if (afterValue !== CANONICAL_WEBHOOK_URL) {
    throw new Error(
      `VERIFICATION FAILED: expected "${CANONICAL_WEBHOOK_URL}", got "${afterValue}"`
    );
  }

  log('VERIFICATION PASSED — webhook URL set and confirmed.');
  log(`\nSummary:`);
  log(`  Agent: ${AGENT_ID}`);
  log(`  Webhook location: ${location}`);
  log(`  URL: ${CANONICAL_WEBHOOK_URL}`);
  log(`  transfer_to_number rules: intact (see count above)`);
}

main().catch((err) => {
  console.error(`[${SCRIPT_NAME}] sync failed:`, err.message || err);
  process.exit(1);
});
