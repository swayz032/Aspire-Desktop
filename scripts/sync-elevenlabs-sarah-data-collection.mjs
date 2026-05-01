#!/usr/bin/env node
// [STATUS: v1] — Configure 8 Data Collection items on Sarah Receptionist agent.
/**
 * PATCHes `platform_settings.data_collection` on the Sarah Receptionist agent with
 * the 8 structured fields from plan §3.6. These fields are extracted by ElevenLabs
 * from the conversation transcript after each call and delivered via the Post-Call
 * Webhook to Aspire's ingestion endpoint.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=sk_... node scripts/sync-elevenlabs-sarah-data-collection.mjs
 *   node scripts/sync-elevenlabs-sarah-data-collection.mjs --dry-run
 *   DRY_RUN=true node scripts/sync-elevenlabs-sarah-data-collection.mjs
 *
 * Idempotent — deep-equals current data_collection against intended; only PATCHes if drifted.
 *
 * CRITICAL CONSTRAINTS:
 *   - Minimal-merge PATCH: only sets platform_settings.data_collection sub-path
 *   - Does NOT touch built_in_tools, workflow, or other platform_settings keys
 *
 * Agent ID: agent_6501kp71h69jfqysgd055hemqhrq (Sarah Receptionist)
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
const SCRIPT_NAME = 'sarah-data-collection';

// ── Canonical Data Collection items (plan §3.6) ───────────────────────────────
// EL Data Collection schema (2026): stored as a dict/object keyed by field name.
// Each value: { type: "string"|"boolean", description: string }
// Confirmed via live API probe 2026-05-01 — NOT an array.
// Enums expressed as type=string with enum values noted in description.
const CANONICAL_DATA_COLLECTION = {
  caller_name: {
    type: 'string',
    description: "The caller's full name as they introduced themselves.",
  },
  caller_callback_number: {
    type: 'string',
    description: 'The phone number the caller wants to be called back at, in E.164 format.',
  },
  intent_category: {
    type: 'string',
    description:
      'The primary reason for the call. One of: faq | sales | support | billing | scheduling | other.',
  },
  urgency: {
    type: 'string',
    description: "How urgent the caller's issue is. One of: low | normal | high.",
  },
  message_body: {
    type: 'string',
    description: 'The full message content the caller wants relayed.',
  },
  requested_callback_window: {
    type: 'string',
    description: 'Time window the caller would prefer to be called back.',
  },
  was_angry: {
    type: 'boolean',
    description: "Whether the caller's tone was hostile or angry.",
  },
  escalation_needed: {
    type: 'boolean',
    description: 'Whether the issue requires immediate human escalation.',
  },
};

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

// ── Deep equality for idempotency check ──────────────────────────────────────
// EL data_collection is stored as a dict keyed by field name.
// Compare current (object) against canonical (object). Keys checked: type, description.
function dataCollectionMatches(current, canonical) {
  if (typeof current !== 'object' || current === null || Array.isArray(current)) return false;
  const canonicalKeys = Object.keys(canonical);
  const currentKeys = Object.keys(current);
  if (canonicalKeys.length !== currentKeys.length) return false;

  for (const key of canonicalKeys) {
    const expected = canonical[key];
    const actual = current[key];
    if (!actual) return false;
    if (actual.type !== expected.type) return false;
    if (actual.description !== expected.description) return false;
  }
  return true;
}

// ── Transfer rules safety check ──────────────────────────────────────────────
function verifyTransferRulesIntact(agentData, phase) {
  const transferRules =
    agentData?.conversation_config?.agent?.built_in_tools?.transfer_to_number
      ?.transfer_list ?? [];
  log(`${phase} transfer_to_number rule count: ${transferRules.length}`);
  if (!DRY_RUN && transferRules.length > 0 && transferRules.length !== 5) {
    console.warn(
      `[${SCRIPT_NAME}] WARNING: ${phase} transfer_to_number rule count is ${transferRules.length} (expected 5).`
    );
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const canonicalKeys = Object.keys(CANONICAL_DATA_COLLECTION);
  log(`Starting Data Collection sync for Sarah Receptionist (${AGENT_ID})`);
  log(`Canonical items: ${canonicalKeys.length}`);
  log(`Dry-run: ${DRY_RUN}`);

  // 1. GET current state
  log('--- BEFORE STATE ---');
  const before = await apiCall('GET', `/convai/agents/${AGENT_ID}`);

  if (before.dry_run) {
    log('[DRY-RUN] Simulating: data_collection would be inspected.');
    log('[DRY-RUN] Would PATCH platform_settings.data_collection with 8 items:');
    log('[DRY-RUN] Items:', canonicalKeys.map((k) => `${k} (${CANONICAL_DATA_COLLECTION[k].type})`));
    log('[DRY-RUN] No changes applied. Exiting.');
    return;
  }

  const currentDataCollection = before?.platform_settings?.data_collection ?? {};
  const currentKeys = typeof currentDataCollection === 'object' && !Array.isArray(currentDataCollection)
    ? Object.keys(currentDataCollection)
    : [];
  log(`Current data_collection item count: ${currentKeys.length}`);
  if (currentKeys.length > 0) {
    log('Current items:', currentKeys.map((k) => `${k} (${currentDataCollection[k]?.type})`));
  }

  verifyTransferRulesIntact(before, 'BEFORE');

  // 2. Idempotency check
  if (dataCollectionMatches(currentDataCollection, CANONICAL_DATA_COLLECTION)) {
    log('IDEMPOTENT — data_collection already matches canonical 8 items. No changes needed.');
    return; // natural return — avoid Windows UV handle assertion from process.exit(0) mid-async
  }

  // 3. PATCH minimal-merge — only platform_settings.data_collection sub-path
  // EL API stores data_collection as a dict keyed by field name (confirmed via live API probe 2026-05-01)
  log('--- APPLYING PATCH ---');
  log(`  Old count: ${currentKeys.length}`);
  log(`  New count: ${canonicalKeys.length}`);
  log('  Changes: setting 8 canonical data collection items');

  const patchBody = {
    platform_settings: {
      data_collection: CANONICAL_DATA_COLLECTION,
    },
  };

  await apiCall('PATCH', `/convai/agents/${AGENT_ID}`, patchBody);
  log('PATCH applied.');

  // 4. Verify post-PATCH
  log('--- VERIFICATION ---');
  const after = await apiCall('GET', `/convai/agents/${AGENT_ID}`);
  const afterDataCollection = after?.platform_settings?.data_collection ?? {};
  const afterKeys = typeof afterDataCollection === 'object' && !Array.isArray(afterDataCollection)
    ? Object.keys(afterDataCollection)
    : [];
  log(`Post-PATCH data_collection item count: ${afterKeys.length}`);
  log('Post-PATCH items:', afterKeys.map((k) => `${k} (${afterDataCollection[k]?.type})`));

  verifyTransferRulesIntact(after, 'AFTER');

  if (afterKeys.length !== canonicalKeys.length) {
    throw new Error(
      `VERIFICATION FAILED: expected ${canonicalKeys.length} items, got ${afterKeys.length}`
    );
  }

  log('VERIFICATION PASSED — data_collection configured with 8 items.');
  log('\nSummary:');
  log(`  Agent: ${AGENT_ID}`);
  log(`  Data Collection items: ${afterKeys.length}`);
  log(`  transfer_to_number rules: intact (see count above)`);
  for (const [name, item] of Object.entries(CANONICAL_DATA_COLLECTION)) {
    log(`    - ${name} (${item.type}): ${item.description.slice(0, 60)}...`);
  }
}

main().catch((err) => {
  console.error(`[${SCRIPT_NAME}] sync failed:`, err.message || err);
  process.exit(1);
});
