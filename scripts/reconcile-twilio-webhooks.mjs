#!/usr/bin/env node
// [STATUS: v1] — Reconcile Twilio IncomingPhoneNumber webhook URLs against Aspire canonical values.
/**
 * Walks every row in `tenant_phone_numbers` (Supabase DB), for each Twilio SID:
 *   1. GETs current webhook config from Twilio
 *   2. Diffs against canonical values
 *   3. PATCHes only the fields that have drifted
 *
 * Canonical values:
 *   voice_url        — LEFT ALONE (EL manages this; EL overwrites on import)
 *   sms_url          → https://orchestrator.aspire.app/v1/ingest/twilio/sms/inbound
 *   sms_method       → POST
 *   status_callback  → https://orchestrator.aspire.app/v1/ingest/twilio/voice/status
 *   status_callback_method → POST
 *
 * Usage:
 *   TWILIO_ACCOUNT_SID=AC... TWILIO_AUTH_TOKEN=... node scripts/reconcile-twilio-webhooks.mjs
 *   railway run -- node scripts/reconcile-twilio-webhooks.mjs   (injects Twilio creds from Railway)
 *   node scripts/reconcile-twilio-webhooks.mjs --dry-run
 *   DRY_RUN=true node scripts/reconcile-twilio-webhooks.mjs
 *
 * Idempotent — only PATCHes fields that differ from canonical values.
 * Logs every comparison with old vs new values.
 *
 * Requires environment:
 *   TWILIO_ACCOUNT_SID — Twilio Account SID (AC...)
 *   TWILIO_AUTH_TOKEN  — Twilio Auth Token
 *   SUPABASE_URL       — Supabase project URL (optional if using --offline-db flag)
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key
 *
 * Note: Supabase MCP is not available in script context. This script uses the Supabase REST API
 * directly to query tenant_phone_numbers.
 */

import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

const DRY_RUN =
  process.argv.includes('--dry-run') ||
  String(process.env.DRY_RUN || '').toLowerCase() === 'true' ||
  !TWILIO_ACCOUNT_SID ||
  !TWILIO_AUTH_TOKEN;

const TWILIO_BASE = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}`;
const SCRIPT_NAME = 'reconcile-twilio-webhooks';

// ── Canonical webhook URLs ────────────────────────────────────────────────────
const CANONICAL = {
  // voice_url is intentionally omitted — EL manages it
  sms_url: 'https://orchestrator.aspire.app/v1/ingest/twilio/sms/inbound',
  sms_method: 'POST',
  status_callback: 'https://orchestrator.aspire.app/v1/ingest/twilio/voice/status',
  status_callback_method: 'POST',
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

// ── Twilio REST API helper (form-encoded) ─────────────────────────────────────
function twilioAuthHeader() {
  const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString(
    'base64'
  );
  return `Basic ${credentials}`;
}

async function twilioGet(path) {
  const url = `${TWILIO_BASE}${path}`;
  log(`${DRY_RUN ? '[DRY-RUN] WOULD ' : ''}GET ${url}`);
  if (DRY_RUN) return { dry_run: true };

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: twilioAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Twilio API ${res.status} GET ${path}: ${text.slice(0, 300)}`);
  }
  return data;
}

async function twilioPost(path, formFields) {
  const url = `${TWILIO_BASE}${path}`;
  const body = new URLSearchParams(formFields).toString();
  log(`${DRY_RUN ? '[DRY-RUN] WOULD ' : ''}POST ${url}`);
  if (DRY_RUN) {
    log('  fields:', formFields);
    return { dry_run: true };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: twilioAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Twilio API ${res.status} POST ${path}: ${text.slice(0, 300)}`);
  }
  return data;
}

// ── Supabase REST helper ──────────────────────────────────────────────────────
async function fetchTenantPhoneNumbers() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    log('WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.');
    log('Attempting to load from .env.local or .env...');

    // Fallback: try to read from common env file paths
    try {
      const fs = await import('fs');
      const envPaths = [
        path.resolve(__dirname, '..', '.env.local'),
        path.resolve(__dirname, '..', '.env'),
      ];
      for (const envPath of envPaths) {
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, 'utf-8');
          for (const line of content.split('\n')) {
            const [key, ...rest] = line.split('=');
            const value = rest.join('=').trim().replace(/^["']|["']$/g, '');
            if (key === 'SUPABASE_URL' && !process.env.SUPABASE_URL)
              process.env.SUPABASE_URL = value;
            if (
              key === 'SUPABASE_SERVICE_ROLE_KEY' &&
              !process.env.SUPABASE_SERVICE_ROLE_KEY
            )
              process.env.SUPABASE_SERVICE_ROLE_KEY = value;
            if (
              key === 'NEXT_PUBLIC_SUPABASE_URL' &&
              !process.env.SUPABASE_URL
            )
              process.env.SUPABASE_URL = value;
          }
          break;
        }
      }
    } catch {
      // ignore
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      log(
        'ERROR: Cannot fetch tenant_phone_numbers without SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
      );
      log('Set these env vars or run via: railway run -- node scripts/reconcile-twilio-webhooks.mjs');
      if (!DRY_RUN) {
        throw new Error('Missing Supabase credentials');
      }
      // In dry-run mode, return mock data
      log('[DRY-RUN] Returning mock tenant_phone_numbers for dry-run simulation.');
      return [
        {
          id: 'mock-uuid-1',
          tenant_id: 'mock-tenant',
          twilio_sid: 'PNmock1234567890',
          phone_number: '+14155550001',
          status: 'active',
        },
      ];
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL || SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;

  const url = `${supabaseUrl}/rest/v1/tenant_phone_numbers?select=id,tenant_id,suite_id,office_id,phone_number,twilio_sid,status&status=eq.active&twilio_sid=neq.null&order=tenant_id`;

  log(`Fetching tenant_phone_numbers from Supabase...`);

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Supabase REST ${res.status} GET tenant_phone_numbers: ${text.slice(0, 300)}`);
  }
  return Array.isArray(data) ? data : [];
}

// ── Build diff ────────────────────────────────────────────────────────────────
function buildDiff(current, canonical) {
  const diff = {};
  for (const [key, canonicalValue] of Object.entries(canonical)) {
    const currentValue = current[key] ?? null;
    if (currentValue !== canonicalValue) {
      diff[key] = { old: currentValue, new: canonicalValue };
    }
  }
  return diff;
}

// ── Reconcile a single phone number ──────────────────────────────────────────
async function reconcileNumber(row) {
  const { twilio_sid, phone_number, tenant_id } = row;
  const sid = twilio_sid;

  // Redact phone for logging (Law #9 — no PII in logs)
  const phonePrefix = phone_number ? phone_number.slice(0, 6) + '...' : '(unknown)';
  log(`\nReconciling ${phonePrefix} (SID: ${sid}, tenant: ${tenant_id})`);

  // GET current Twilio config
  const twilioData = await twilioGet(`/IncomingPhoneNumbers/${sid}.json`);

  if (twilioData?.dry_run) {
    log(`[DRY-RUN] Would compare ${phonePrefix} against canonical webhooks.`);
    log('[DRY-RUN] Canonical values:', CANONICAL);
    return { sid, dryRun: true };
  }

  // Extract current values
  const current = {
    sms_url: twilioData.sms_url ?? null,
    sms_method: twilioData.sms_method ?? null,
    status_callback: twilioData.status_callback ?? null,
    status_callback_method: twilioData.status_callback_method ?? null,
    // voice_url logged but NOT included in diff/patch — EL manages it
    voice_url: twilioData.voice_url ?? null,
  };

  log(`Current config for ${phonePrefix}:`, {
    voice_url: current.voice_url + ' (EL-managed, not touched)',
    sms_url: current.sms_url,
    sms_method: current.sms_method,
    status_callback: current.status_callback,
    status_callback_method: current.status_callback_method,
  });

  const diff = buildDiff(current, CANONICAL);

  if (Object.keys(diff).length === 0) {
    log(`IDEMPOTENT — ${phonePrefix} already matches canonical webhooks. Skipping.`);
    return { sid, changed: false };
  }

  log(`Drift detected for ${phonePrefix}:`, diff);

  // Build PATCH form fields with only drifted values
  const formFields = {};
  for (const [key, { new: newValue }] of Object.entries(diff)) {
    // Convert key to Twilio param format (snake_case → PascalCase/TwilioParam)
    const twilioKey = key
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('');
    formFields[twilioKey] = newValue;
  }

  log(`Patching ${phonePrefix} with:`, formFields);

  await twilioPost(`/IncomingPhoneNumbers/${sid}.json`, formFields);

  log(`PATCHED ${phonePrefix} successfully.`);
  return { sid, changed: true, diff };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting Twilio webhook reconciliation`);
  log(`Canonical webhooks:`, CANONICAL);
  log(`Dry-run: ${DRY_RUN}`);

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    if (DRY_RUN) {
      log('[DRY-RUN] No Twilio credentials — running in simulation mode.');
    } else {
      throw new Error(
        'Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN. ' +
        'Run via: railway run -- node scripts/reconcile-twilio-webhooks.mjs'
      );
    }
  }

  // 1. Load tenant_phone_numbers from Supabase
  const rows = await fetchTenantPhoneNumbers();
  log(`Found ${rows.length} active tenant phone number(s) with Twilio SIDs.`);

  if (rows.length === 0) {
    log('No numbers to reconcile. Exiting.');
    return;
  }

  // 2. Reconcile each number
  const results = {
    total: rows.length,
    changed: 0,
    unchanged: 0,
    errors: 0,
    details: [],
  };

  for (const row of rows) {
    try {
      const result = await reconcileNumber(row);
      if (result.changed) {
        results.changed++;
      } else {
        results.unchanged++;
      }
      results.details.push({ ...result, status: 'ok' });
    } catch (err) {
      results.errors++;
      const phonePrefix = row.phone_number
        ? row.phone_number.slice(0, 6) + '...'
        : '(unknown)';
      log(`ERROR reconciling ${phonePrefix} (SID: ${row.twilio_sid}): ${err.message}`);
      results.details.push({
        sid: row.twilio_sid,
        status: 'error',
        error: err.message.slice(0, 200),
      });
    }
  }

  // 3. Summary
  log('\n=== RECONCILIATION COMPLETE ===');
  log(`Total numbers: ${results.total}`);
  log(`Changed: ${results.changed}`);
  log(`Unchanged (already canonical): ${results.unchanged}`);
  log(`Errors: ${results.errors}`);

  if (results.errors > 0) {
    log('WARNING: Some numbers had errors. Check output above.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[${SCRIPT_NAME}] reconcile failed:`, err.message || err);
  process.exit(1);
});
